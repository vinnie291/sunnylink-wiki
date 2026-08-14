// Port of openpilot's model projection math, used to replay a recorded modelV2
// stream onto a virtual road.
//
// Source files mirrored (commaai/openpilot @ master):
//   - selfdrive/ui/onroad/model_renderer.py      (_map_to_screen / _map_line_to_polygon)
//   - selfdrive/ui/onroad/augmented_road_view.py (calib_transform / video_transform)
//   - common/transformations/camera.py           (intrinsics, view<-device frame)
//   - common/transformations/transformations.py  (euler2rot, Z-Y-X order)
//
// Coordinate frames:
//   model/calib frame : x->forward, y->left, z->up  (meters)
//   view frame        : x->right,   y->down, z->forward
//   screen            : pixels in the target rect

export interface Camera {
  width: number;
  height: number;
  focalLength: number;
}

export interface Calib {
  rpy: [number, number, number]; // roll, pitch, yaw (radians)
  height: number; // camera height above road (m)
}

export interface Line3D {
  x: number[];
  y: number[];
  z: number[];
}

export interface ModelFrame {
  path: [number[], number[], number[]]; // [xs, ys, zs]
  lanes: [number[], number[], number[]][]; // 4 lines
  laneProbs: number[];
  edges: [number[], number[], number[]][]; // 2 edges
  edgeStds: number[];
}

export interface RouteData {
  route: string;
  fps: number;
  camera: Camera;
  calib: Calib;
  frames: ModelFrame[];
}

export type Mat3 = number[]; // row-major length 9
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CLIP_MARGIN = 500;
const MIN_DRAW_DISTANCE = 10.0;
const MAX_DRAW_DISTANCE = 100.0;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

function matVec(m: Mat3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

// euler2rot: Rz(yaw) @ Ry(pitch) @ Rx(roll), euler = [roll, pitch, yaw]
function eulerToRot([phi, theta, psi]: [number, number, number]): Mat3 {
  const cx = Math.cos(phi), sx = Math.sin(phi);
  const cy = Math.cos(theta), sy = Math.sin(theta);
  const cz = Math.cos(psi), sz = Math.sin(psi);
  const Rx: Mat3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Ry: Mat3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rz: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return matMul(Rz, matMul(Ry, Rx));
}

// device_frame_from_view = [[0,0,1],[1,0,0],[0,1,0]] ; view<-device is its transpose
const VIEW_FROM_DEVICE: Mat3 = [0, 1, 0, 0, 0, 1, 1, 0, 0];

/**
 * Build the 3x3 car-space -> screen transform, matching augmented_road_view's
 * `video_transform @ calib_transform`. With no real camera image we still use
 * the camera intrinsics + zoom so the geometry matches the device UI exactly.
 */
export function buildTransform(cam: Camera, calib: Calib, rect: Rect, zoomBase = 1.1): Mat3 {
  const f = cam.focalLength;
  const cx = cam.width / 2;
  const cy = cam.height / 2;
  const K: Mat3 = [f, 0, cx, 0, f, cy, 0, 0, 1];

  const viewFromCalib = matMul(VIEW_FROM_DEVICE, eulerToRot(calib.rpy));
  const calibTransform = matMul(K, viewFromCalib);

  // vanishing point: calib_transform @ [1000,0,0]
  const kep = matVec(calibTransform, [1000, 0, 0]);

  const { x, y, width: w, height: h } = rect;
  const zoom = Math.max(zoomBase, w / (2 * cx), h / (2 * cy));
  const margin = 5;
  const maxXOff = Math.max(0, cx * zoom - w / 2 - margin);
  const maxYOff = Math.max(0, cy * zoom - h / 2 - margin);

  let xOff = 0, yOff = 0;
  if (Math.abs(kep[2]) > 1e-6) {
    xOff = clamp((kep[0] / kep[2] - cx) * zoom, -maxXOff, maxXOff);
    yOff = clamp((kep[1] / kep[2] - cy) * zoom, -maxYOff, maxYOff);
  }

  const videoTransform: Mat3 = [
    zoom, 0, w / 2 + x - xOff - cx * zoom,
    0, zoom, h / 2 + y - yOff - cy * zoom,
    0, 0, 1,
  ];
  return matMul(videoTransform, calibTransform);
}

export function clipRegion(rect: Rect): Rect {
  return {
    x: rect.x - CLIP_MARGIN,
    y: rect.y - CLIP_MARGIN,
    width: rect.width + 2 * CLIP_MARGIN,
    height: rect.height + 2 * CLIP_MARGIN,
  };
}

function pathLengthIdx(xs: number[], dist: number): number {
  let idx = 0;
  for (let i = 0; i < xs.length; i++) if (xs[i] <= dist) idx = i;
  return idx;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Port of ModelRenderer._map_line_to_polygon. Returns a closed polygon
 * (left edge forward, then right edge back) in screen space, or [] if nothing
 * is visible.
 */
export function mapLineToPolygon(
  line: [number[], number[], number[]],
  yOff: number,
  zOff: number,
  maxIdx: number,
  maxDistance: number,
  T: Mat3,
  clip: Rect,
  allowInvert = true
): Point[] {
  const [xs, ys, zs] = line;
  const n0 = xs.length;
  if (n0 === 0) return [];

  // slice [0..maxIdx], plus an interpolated endpoint at maxDistance
  const px: number[] = [];
  const py: number[] = [];
  const pz: number[] = [];
  for (let i = 0; i <= maxIdx && i < n0; i++) {
    px.push(xs[i]);
    py.push(ys[i]);
    pz.push(zs[i]);
  }
  if (maxIdx > 0 && maxIdx < n0 - 1) {
    const x0 = xs[maxIdx], x1 = xs[maxIdx + 1];
    const t = x1 !== x0 ? (maxDistance - x0) / (x1 - x0) : 0;
    px.push(maxDistance);
    py.push(lerp(ys[maxIdx], ys[maxIdx + 1], t));
    pz.push(lerp(zs[maxIdx], zs[maxIdx + 1], t));
  }

  const xMin = clip.x, xMax = clip.x + clip.width;
  const yMin = clip.y, yMax = clip.y + clip.height;

  const leftPts: Point[] = [];
  const rightPts: Point[] = [];
  for (let i = 0; i < px.length; i++) {
    if (px[i] < 0) continue;
    const l = matVec(T, [px[i], py[i] - yOff, pz[i] + zOff]);
    const r = matVec(T, [px[i], py[i] + yOff, pz[i] + zOff]);
    if (Math.abs(l[2]) < 1e-6 || Math.abs(r[2]) < 1e-6) continue;
    const lx = l[0] / l[2], ly = l[1] / l[2];
    const rx = r[0] / r[2], ry = r[1] / r[2];
    const lIn = lx >= xMin && lx <= xMax && ly >= yMin && ly <= yMax;
    const rIn = rx >= xMin && rx <= xMax && ry >= yMin && ry <= yMax;
    if (!(lIn && rIn)) continue;
    leftPts.push({ x: lx, y: ly });
    rightPts.push({ x: rx, y: ry });
  }
  if (leftPts.length === 0) return [];

  // Drop points that move back down the screen (hills), to keep the fill clean.
  if (!allowInvert && leftPts.length > 1) {
    const keepL: Point[] = [];
    const keepR: Point[] = [];
    let minY = Infinity;
    for (let i = 0; i < leftPts.length; i++) {
      if (leftPts[i].y <= minY) {
        minY = leftPts[i].y;
        keepL.push(leftPts[i]);
        keepR.push(rightPts[i]);
      }
    }
    if (keepL.length === 0) return [];
    return [...keepL, ...keepR.reverse()];
  }

  return [...leftPts, ...rightPts.reverse()];
}

export interface ProjectedFrame {
  lanes: { points: Point[]; prob: number }[];
  edges: { points: Point[]; std: number }[];
  path: Point[];
}

/** Project a full modelV2 frame to screen polygons (mirrors _update_model). */
export function projectFrame(frame: ModelFrame, calib: Calib, T: Mat3, rect: Rect): ProjectedFrame {
  const clip = clipRegion(rect);
  const pathXs = frame.path[0];
  const maxDistance = clamp(pathXs[pathXs.length - 1] ?? 0, MIN_DRAW_DISTANCE, MAX_DRAW_DISTANCE);

  const lane0Xs = frame.lanes[0]?.[0] ?? [];
  const maxIdx = pathLengthIdx(lane0Xs, maxDistance);

  const lanes = frame.lanes.map((ln, i) => ({
    prob: frame.laneProbs[i] ?? 0,
    points: mapLineToPolygon(ln, 0.025 * (frame.laneProbs[i] ?? 0), 0, maxIdx, maxDistance, T, clip),
  }));

  const edges = frame.edges.map((ed, i) => ({
    std: frame.edgeStds[i] ?? 1,
    points: mapLineToPolygon(ed, 0.025, 0, maxIdx, maxDistance, T, clip),
  }));

  const pathMaxIdx = pathLengthIdx(pathXs, maxDistance);
  const path = mapLineToPolygon(
    frame.path,
    0.9,
    calib.height,
    pathMaxIdx,
    maxDistance,
    T,
    clip,
    false
  );

  return { lanes, edges, path };
}

export function polyToSvgPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
