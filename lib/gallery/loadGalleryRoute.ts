import { ParsedModelV2 } from '../openpilotLog/parseLogFile';

// Gallery data files are the compact JSON emitted by
// scripts/sim/extract_modelv2.py (path/lanes/edges per frame at a fixed fps),
// converted here into the ParsedModelV2 shape the openpilot renderer port
// consumes, so gallery playback and rlog replay share one rendering path.

interface ExtractedFrame {
    path: number[][];
    lanes: number[][][];
    laneProbs: number[];
    edges: number[][][];
    edgeStds: number[];
}

export interface GalleryRouteData {
    route: string;
    fps: number;
    calib: { rpy: number[]; height: number };
    frames: ParsedModelV2[];
}

export interface GalleryEntry {
    slug: string;
    name: string;
    sourceType: 'recorded' | 'harness' | 'community';
    modelDate: string;
    description: string;
    dataUrl: string;
}

export interface GalleryIndex {
    route: {
        id: string;
        name: string;
        description: string;
        source: string;
        durationSec: number;
    };
    entries: GalleryEntry[];
}

function toXYZ(line: number[][]) {
    return {
        x: Float32Array.from(line[0]),
        y: Float32Array.from(line[1]),
        z: Float32Array.from(line[2]),
    };
}

export async function fetchGalleryIndex(): Promise<GalleryIndex> {
    const res = await fetch('/gallery/index.json');
    if (!res.ok) throw new Error(`gallery index: HTTP ${res.status}`);
    return res.json();
}

export async function fetchGalleryRoute(dataUrl: string): Promise<GalleryRouteData> {
    const res = await fetch(dataUrl);
    if (!res.ok) throw new Error(`gallery route: HTTP ${res.status}`);
    const raw = await res.json();

    const nsPerFrame = BigInt(Math.round(1e9 / raw.fps));
    const frames: ParsedModelV2[] = (raw.frames as ExtractedFrame[]).map((f, i) => ({
        logMonoTime: BigInt(i) * nsPerFrame,
        position: toXYZ(f.path),
        laneLines: f.lanes.map(toXYZ),
        laneLineProbs: Float32Array.from(f.laneProbs),
        roadEdges: f.edges.map(toXYZ),
        roadEdgeStds: Float32Array.from(f.edgeStds),
        accelerationX: new Float32Array(0),
    }));

    return { route: raw.route, fps: raw.fps, calib: raw.calib, frames };
}
