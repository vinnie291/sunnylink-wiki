// A TypeScript port of openpilot's actual onroad rendering math, ported
// directly from the real, current source (not reverse-engineered):
//   - selfdrive/ui/onroad/model_renderer.py (ModelRenderer._map_line_to_polygon,
//     ._draw_lane_lines, ._draw_path, and the THROTTLE_COLORS/NO_THROTTLE_COLORS
//     gradients)
//   - selfdrive/ui/onroad/augmented_road_view.py (AugmentedRoadView._calc_frame_matrix)
//   - common/transformations/camera.py (DEVICE_CAMERAS intrinsics,
//     view_frame_from_device_frame, get_view_frame_from_calib_frame)
//   - common/transformations/transformations.py (euler2rot_single: Rz@Ry@Rx)
//
// This intentionally omits pieces that need messages we don't decode from
// the log (radarState lead indicator, selfdriveState.experimentalMode,
// longitudinalPlan.allowThrottle) — see the README in lib/openpilotLog/schema
// for what's decoded. The path always renders with the "allow throttle"
// gradient, matching ModelRenderer's own initial blend-filter state (1.0)
// before any live longitudinalPlan sample would change it.

import type { ParsedModelV2 } from './openpilotLog/parseLogFile';

export interface Point2D { x: number; y: number }
type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];
type Vec3 = [number, number, number];

function matMul3(a: Mat3, b: Mat3): Mat3 {
    const r: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
        }
    }
    return r as Mat3;
}

function matVec3(a: Mat3, v: Vec3): Vec3 {
    return [
        a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2],
        a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2],
        a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2],
    ];
}

// transformations.py: euler2rot_single — Rotation order Z-Y-X (yaw, pitch, roll).
function rotFromEuler(roll: number, pitch: number, yaw: number): Mat3 {
    const cx = Math.cos(roll), sx = Math.sin(roll);
    const cy = Math.cos(pitch), sy = Math.sin(pitch);
    const cz = Math.cos(yaw), sz = Math.sin(yaw);
    const Rx: Mat3 = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
    const Ry: Mat3 = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
    const Rz: Mat3 = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
    return matMul3(matMul3(Rz, Ry), Rx);
}

// camera.py: device_frame_from_view_frame.T
const VIEW_FRAME_FROM_DEVICE_FRAME: Mat3 = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];

// camera.py: DEVICE_CAMERAS[("tici", "ar0231")].fcam — comma three's road camera.
// The only shipping hardware, so this is hardcoded rather than configurable.
const FCAM_WIDTH = 1928;
const FCAM_HEIGHT = 1208;
const FCAM_FOCAL = 2648.0;
const INTRINSIC: Mat3 = [
    [FCAM_FOCAL, 0, FCAM_WIDTH / 2],
    [0, FCAM_FOCAL, FCAM_HEIGHT / 2],
    [0, 0, 1],
];

const INF_POINT: Vec3 = [1000, 0, 0];
const ZOOM = 1.1; // augmented_road_view.py: non-wide-camera zoom

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

// augmented_road_view.py: AugmentedRoadView._calc_frame_matrix
// Produces the same 3x3 car-space-to-screen-space transform the real UI
// computes from live calibration, sized to our own canvas rect (rect is
// assumed to start at 0,0 in canvas-local coordinates).
export function calcFrameMatrix(rpyCalib: ArrayLike<number>, rectWidth: number, rectHeight: number): Mat3 {
    const roll = rpyCalib[0] ?? 0;
    const pitch = rpyCalib[1] ?? 0;
    const yaw = rpyCalib[2] ?? 0;
    const deviceFromCalib = rotFromEuler(roll, pitch, yaw);
    const calibration = matMul3(VIEW_FRAME_FROM_DEVICE_FRAME, deviceFromCalib);
    const calibTransform = matMul3(INTRINSIC, calibration);
    const kep = matVec3(calibTransform, INF_POINT);

    const cx = INTRINSIC[0][2];
    const cy = INTRINSIC[1][2];
    const zoom = Math.max(ZOOM, rectWidth / (2 * cx), rectHeight / (2 * cy));

    const margin = 5;
    const maxXOffset = Math.max(0, cx * zoom - rectWidth / 2 - margin);
    const maxYOffset = Math.max(0, cy * zoom - rectHeight / 2 - margin);

    let xOffset = 0;
    let yOffset = 0;
    if (Math.abs(kep[2]) > 1e-6) {
        xOffset = clamp((kep[0] / kep[2] - cx) * zoom, -maxXOffset, maxXOffset);
        yOffset = clamp((kep[1] / kep[2] - cy) * zoom, -maxYOffset, maxYOffset);
    }

    const videoTransform: Mat3 = [
        [zoom, 0, (rectWidth / 2 - xOffset) - cx * zoom],
        [0, zoom, (rectHeight / 2 - yOffset) - cy * zoom],
        [0, 0, 1],
    ];

    return matMul3(videoTransform, calibTransform);
}

interface ClipRegion { x: number; y: number; width: number; height: number }

// model_renderer.py: ModelRenderer._get_path_length_idx
function getPathLengthIdx(posX: Float32Array, pathDistance: number): number {
    let idx = 0;
    for (let i = 0; i < posX.length; i++) {
        if (posX[i] <= pathDistance) idx = i;
        else break;
    }
    return idx;
}

interface XYZLine { x: Float32Array; y: Float32Array; z: Float32Array }

// model_renderer.py: ModelRenderer._map_line_to_polygon
// Converts a 3D car-space line into a 2D screen-space ribbon polygon by
// offsetting left/right by yOff (and zOff for the path), truncating at
// maxDistance with a smooth interpolated endpoint, and clipping to the
// visible rect.
function mapLineToPolygon(
    line: XYZLine,
    yOff: number,
    zOff: number,
    maxIdx: number,
    maxDistance: number,
    transform: Mat3,
    clip: ClipRegion,
    allowInvert: boolean,
): Point2D[] {
    const n = line.x.length;
    if (n === 0) return [];

    const ptX: number[] = [];
    const ptY: number[] = [];
    const ptZ: number[] = [];
    for (let i = 0; i <= Math.min(maxIdx, n - 1); i++) {
        ptX.push(line.x[i]); ptY.push(line.y[i]); ptZ.push(line.z[i]);
    }
    if (maxIdx > 0 && maxIdx < n - 1) {
        const x0 = line.x[maxIdx], x1 = line.x[maxIdx + 1];
        const t = x1 === x0 ? 0 : (maxDistance - x0) / (x1 - x0);
        ptX.push(maxDistance);
        ptY.push(line.y[maxIdx] + (line.y[maxIdx + 1] - line.y[maxIdx]) * t);
        ptZ.push(line.z[maxIdx] + (line.z[maxIdx + 1] - line.z[maxIdx]) * t);
    }

    const left: Point2D[] = [];
    const right: Point2D[] = [];
    for (let i = 0; i < ptX.length; i++) {
        if (ptX[i] < 0) continue;

        const lp = matVec3(transform, [ptX[i], ptY[i] - yOff, ptZ[i] + zOff]);
        const rp = matVec3(transform, [ptX[i], ptY[i] + yOff, ptZ[i] + zOff]);
        if (Math.abs(lp[2]) < 1e-6 || Math.abs(rp[2]) < 1e-6) continue;

        const lx = lp[0] / lp[2], ly = lp[1] / lp[2];
        const rx = rp[0] / rp[2], ry = rp[1] / rp[2];

        const lIn = lx >= clip.x && lx <= clip.x + clip.width && ly >= clip.y && ly <= clip.y + clip.height;
        const rIn = rx >= clip.x && rx <= clip.x + clip.width && ry >= clip.y && ry <= clip.y + clip.height;
        if (!lIn || !rIn) continue;

        left.push({ x: lx, y: ly });
        right.push({ x: rx, y: ry });
    }

    if (!allowInvert && left.length > 1) {
        let runningMin = Infinity;
        const keptLeft: Point2D[] = [];
        const keptRight: Point2D[] = [];
        for (let i = 0; i < left.length; i++) {
            if (left[i].y <= runningMin) {
                runningMin = left[i].y;
                keptLeft.push(left[i]);
                keptRight.push(right[i]);
            }
        }
        return [...keptLeft, ...keptRight.reverse()];
    }

    return [...left, ...right.reverse()];
}

const CLIP_MARGIN = 500;
const MIN_DRAW_DISTANCE = 10.0;
const MAX_DRAW_DISTANCE = 100.0;

// model_renderer.py: THROTTLE_COLORS / NO_THROTTLE_COLORS (rgba 0..255 → 0..1 here)
export const THROTTLE_COLORS = [
    'rgba(13,248,122,0.4)',
    'rgba(114,255,92,0.35)',
    'rgba(114,255,92,0)',
] as const;
export const NO_THROTTLE_COLORS = [
    'rgba(242,242,242,0.4)',
    'rgba(242,242,242,0.35)',
    'rgba(242,242,242,0)',
] as const;

export interface RenderPolygon { points: Point2D[]; color: string }
export interface RenderFrame {
    laneLines: RenderPolygon[];
    roadEdges: RenderPolygon[];
    path: { points: Point2D[]; gradientColors: readonly string[] } | null;
}

// model_renderer.py: ModelRenderer._update_model / _draw_lane_lines / _draw_path,
// minus the radarState lead indicator and live experimentalMode/allowThrottle
// (not decoded from the log — see module docblock).
export function computeModelRenderFrame(
    model: ParsedModelV2,
    rpyCalib: ArrayLike<number>,
    rectWidth: number,
    rectHeight: number,
    // model_renderer.py: self._path_offset_z, sourced from liveCalibration's
    // height (callers fall back to HEIGHT_INIT when the log doesn't carry it,
    // matching openpilot — a 0 offset collapses the path onto the horizon).
    pathOffsetZ = 0,
): RenderFrame {
    const transform = calcFrameMatrix(rpyCalib, rectWidth, rectHeight);
    const clip: ClipRegion = {
        x: -CLIP_MARGIN,
        y: -CLIP_MARGIN,
        width: rectWidth + 2 * CLIP_MARGIN,
        height: rectHeight + 2 * CLIP_MARGIN,
    };

    const pathX = model.position.x;
    if (pathX.length === 0) return { laneLines: [], roadEdges: [], path: null };

    const maxDistance = clamp(pathX[pathX.length - 1], MIN_DRAW_DISTANCE, MAX_DRAW_DISTANCE);
    const laneLineMaxIdx = model.laneLines.length > 0
        ? getPathLengthIdx(model.laneLines[0].x, maxDistance)
        : 0;

    const laneLines: RenderPolygon[] = model.laneLines.map((line, i) => {
        const prob = model.laneLineProbs[i] ?? 0;
        const alpha = clamp(prob, 0, 0.7);
        const points = mapLineToPolygon(line, 0.025 * prob, 0, laneLineMaxIdx, maxDistance, transform, clip, true);
        return { points, color: `rgba(255,255,255,${alpha.toFixed(3)})` };
    });

    const roadEdges: RenderPolygon[] = model.roadEdges.map((edge, i) => {
        const std = model.roadEdgeStds[i] ?? 0;
        const alpha = clamp(1 - std, 0, 1);
        const points = mapLineToPolygon(edge, 0.025, 0, laneLineMaxIdx, maxDistance, transform, clip, true);
        return { points, color: `rgba(255,0,0,${alpha.toFixed(3)})` };
    });

    const pathMaxIdx = getPathLengthIdx(pathX, maxDistance);
    const pathPoints = mapLineToPolygon(model.position, 0.9, pathOffsetZ, pathMaxIdx, maxDistance, transform, clip, false);

    return {
        laneLines,
        roadEdges,
        path: pathPoints.length > 0 ? { points: pathPoints, gradientColors: THROTTLE_COLORS } : null,
    };
}

// Draws a computed RenderFrame onto a 2D canvas context sized rectWidth x
// rectHeight. Lane lines/road edges are flat-filled; the path uses a
// top-to-bottom linear gradient matching model_renderer.py's vertical
// Gradient(start=(0,1), end=(0,0), ...) convention.
export function drawModelRenderFrame(
    ctx: CanvasRenderingContext2D,
    frame: RenderFrame,
    rectWidth: number,
    rectHeight: number,
): void {
    const fillPolygon = (points: Point2D[], fillStyle: string | CanvasGradient) => {
        if (points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
    };

    for (const edge of frame.roadEdges) fillPolygon(edge.points, edge.color);
    for (const line of frame.laneLines) fillPolygon(line.points, line.color);

    if (frame.path) {
        const gradient = ctx.createLinearGradient(0, rectHeight, 0, 0);
        const stops = [0, 0.5, 1];
        frame.path.gradientColors.forEach((color, i) => gradient.addColorStop(stops[i], color));
        fillPolygon(frame.path.points, gradient);
    }
}
