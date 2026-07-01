import * as $ from 'capnp-es';
import { decompress as zstdDecompress } from 'fzstd';
import { Event } from './generated/log';

// XYZTData → plain arrays (detached from the capnp buffer so parsed logs
// don't keep the whole message's ArrayBuffer alive).
export interface XYZTPoints {
    x: Float32Array;
    y: Float32Array;
    z: Float32Array;
}

export interface ParsedModelV2 {
    logMonoTime: bigint;
    position: XYZTPoints;
    laneLines: XYZTPoints[];
    laneLineProbs: Float32Array;
    roadEdges: XYZTPoints[];
    roadEdgeStds: Float32Array;
    accelerationX: Float32Array;
}

export interface ParsedLiveCalibration {
    logMonoTime: bigint;
    rpyCalib: Float32Array;
    height: number;
}

export interface ParsedLog {
    modelV2: ParsedModelV2[];
    liveCalibration: ParsedLiveCalibration[];
}

const ZSTD_MAGIC = 0x28b52ffd;

function isZstdFrame(bytes: Uint8Array): boolean {
    if (bytes.length < 4) return false;
    const magic = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
    return magic === ZSTD_MAGIC;
}

// Standard Cap'n Proto unpacked multi-message stream framing: each message
// starts with (segmentCount - 1) as a uint32, then that many uint32 segment
// sizes (in words), the header padded to 8 bytes, followed by the segments'
// raw bytes. Real rlog/qlog files are a back-to-back stream of these
// messages (mirrors capnp's own Event.read_multiple_bytes on the Python
// side) — capnp-es only parses a single message per buffer, so multi-message
// iteration is done here.
function messageByteLength(buf: Uint8Array, offset: number): number {
    const dv = new DataView(buf.buffer, buf.byteOffset + offset, buf.byteLength - offset);
    const segmentCount = dv.getUint32(0, true) + 1;
    let headerLen = 4 + segmentCount * 4;
    headerLen = (headerLen + 7) & ~7;
    let total = headerLen;
    for (let i = 0; i < segmentCount; i++) {
        total += dv.getUint32(4 + i * 4, true) * 8;
    }
    return total;
}

function toXYZTPoints(data: { x: $.List<number>; y: $.List<number>; z: $.List<number> }): XYZTPoints {
    return {
        x: Float32Array.from(data.x),
        y: Float32Array.from(data.y),
        z: Float32Array.from(data.z),
    };
}

function parseModelV2(event: Event): ParsedModelV2 {
    const model = event.modelV2;
    const laneLines: XYZTPoints[] = [];
    for (const line of model.laneLines) laneLines.push(toXYZTPoints(line));
    const roadEdges: XYZTPoints[] = [];
    for (const edge of model.roadEdges) roadEdges.push(toXYZTPoints(edge));
    return {
        logMonoTime: event.logMonoTime,
        position: toXYZTPoints(model.position),
        laneLines,
        laneLineProbs: Float32Array.from(model.laneLineProbs),
        roadEdges,
        roadEdgeStds: Float32Array.from(model.roadEdgeStds),
        accelerationX: Float32Array.from(model.acceleration.x),
    };
}

function parseLiveCalibration(event: Event): ParsedLiveCalibration {
    const calib = event.liveCalibration;
    const height = calib.height;
    return {
        logMonoTime: event.logMonoTime,
        rpyCalib: Float32Array.from(calib.rpyCalib),
        height: height.length > 0 ? height.get(0) : 0,
    };
}

// Parses a whole rlog/qlog file's bytes (optionally zstd-compressed) into
// ordered modelV2/liveCalibration samples. bz2-compressed (pre-zstd) logs
// aren't handled yet — see the plan's Phase A note.
export function parseLogFile(fileBytes: Uint8Array): ParsedLog {
    const bytes = isZstdFrame(fileBytes) ? zstdDecompress(fileBytes) : fileBytes;

    const modelV2: ParsedModelV2[] = [];
    const liveCalibration: ParsedLiveCalibration[] = [];

    let offset = 0;
    while (offset < bytes.byteLength) {
        const remaining = bytes.byteLength - offset;
        if (remaining < 8) break;
        let len: number;
        try {
            len = messageByteLength(bytes, offset);
        } catch {
            break;
        }
        if (len <= 0 || offset + len > bytes.byteLength) break;

        const slice = bytes.subarray(offset, offset + len);
        try {
            const message = new $.Message(slice, false);
            const event = message.getRoot(Event);
            switch (event.which()) {
                case Event.MODEL_V2:
                    modelV2.push(parseModelV2(event));
                    break;
                case Event.LIVE_CALIBRATION:
                    liveCalibration.push(parseLiveCalibration(event));
                    break;
                default:
                    break;
            }
        } catch {
            // Skip messages capnp-es can't parse (e.g. schema drift on very
            // old logs) rather than aborting the whole file.
        }
        offset += len;
    }

    modelV2.sort((a, b) => (a.logMonoTime < b.logMonoTime ? -1 : a.logMonoTime > b.logMonoTime ? 1 : 0));
    liveCalibration.sort((a, b) => (a.logMonoTime < b.logMonoTime ? -1 : a.logMonoTime > b.logMonoTime ? 1 : 0));

    return { modelV2, liveCalibration };
}
