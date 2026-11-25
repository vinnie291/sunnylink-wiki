import type { Vehicle } from './simulation';

/** Shared metric pinhole camera parameters (must match svgProjection.ts). */
export const CAR_CAMERA = { width: 480, height: 270, horizon: 84, focal: 300, heightM: 1.65, near: 2.5 };

export interface Vec3Cam {
  x: number;
  z: number;
  height: number;
}

/**
 * 3D pose of a vehicle in camera space:
 * - `center`: ground point (height = 0) at vehicle midpoint
 * - `forward`: unit XZ vector pointing toward the vehicle's front bumper
 * - `right`: unit XZ vector pointing toward the vehicle's right (passenger) side
 */
export interface VehicleCameraPose {
  center: { x: number; z: number };
  forward: { x: number; z: number };
  right: { x: number; z: number };
}

interface Palette {
  top: string;
  rear: string;
  front: string;
  sideLight: string;
  sideDark: string;
}

const PAINTS: Palette[] = [
  // Silver metallic
  { top: '#eef2f5', front: '#dce3e8', rear: '#cfd7de', sideLight: '#dde4e9', sideDark: '#aeb9c2' },
  // Slate blue-grey
  { top: '#8395a7', front: '#6f8194', rear: '#5f7082', sideLight: '#76889a', sideDark: '#4f5e6f' },
  // Deep crimson
  { top: '#a64d53', front: '#8f3d43', rear: '#7c3238', sideLight: '#964349', sideDark: '#65262b' },
  // Warm champagne / sand
  { top: '#d6d0c4', front: '#c4bdb0', rear: '#b5ae9f', sideLight: '#c9c2b5', sideDark: '#999284' },
  // Teal / Pacific green
  { top: '#4a7078', front: '#3b5d64', rear: '#314f56', sideLight: '#41656d', sideDark: '#263f45' },
  // Graphite charcoal
  { top: '#58626e', front: '#464f59', rear: '#3a424b', sideLight: '#4d5661', sideDark: '#2d343c' },
  // Ice blue-silver
  { top: '#becbd4', front: '#a9b7c1', rear: '#97a6b1', sideLight: '#b1bfca', sideDark: '#7d8c97' },
  // Cobalt blue
  { top: '#466891', front: '#38567b', rear: '#2e4869', sideLight: '#3e5e85', sideDark: '#233853' },
];

const CAB_PAINTS: Palette[] = [
  { top: '#3c6282', front: '#2f506d', rear: '#26425b', sideLight: '#355876', sideDark: '#1e354a' },
  { top: '#94383c', front: '#7d2c30', rear: '#692327', sideLight: '#873236', sideDark: '#541b1e' },
  { top: '#d8dde0', front: '#c3c9cd', rear: '#b1b8bd', sideLight: '#ccd2d6', sideDark: '#929a9f' },
  { top: '#3d5e57', front: '#304c46', rear: '#273f3a', sideLight: '#36544e', sideDark: '#1d312d' },
];

function projectCam(p: Vec3Cam) {
  return {
    x: CAR_CAMERA.width / 2 + (CAR_CAMERA.focal * p.x) / p.z,
    y: CAR_CAMERA.horizon + (CAR_CAMERA.focal * (CAR_CAMERA.heightM - p.height)) / p.z,
  };
}

function clipNear(points: Vec3Cam[]): Vec3Cam[] {
  const out: Vec3Cam[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const inA = a.z >= CAR_CAMERA.near;
    const inB = b.z >= CAR_CAMERA.near;
    if (inA) out.push(a);
    if (inA !== inB) {
      const t = (CAR_CAMERA.near - a.z) / (b.z - a.z);
      out.push({
        x: a.x + (b.x - a.x) * t,
        z: CAR_CAMERA.near,
        height: a.height + (b.height - a.height) * t,
      });
    }
  }
  return out;
}

/**
 * Projects a 3D polygon defined with outward CCW winding.
 * Culls back-facing polygons (`signedArea >= -0.04`) automatically so hidden walls
 * and roofs above eye level never render inside-out.
 */
function polyFace(
  pts: Vec3Cam[],
  fill: string,
  opts?: { stroke?: string; strokeWidth?: number; opacity?: number; cull?: boolean },
): string {
  const clipped = clipNear(pts);
  if (clipped.length < 3) return '';
  const screen = clipped.map(projectCam);
  for (const s of screen) {
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return '';
  }
  if (opts?.cull !== false) {
    let area2 = 0;
    for (let i = 0; i < screen.length; i++) {
      const a = screen[i];
      const b = screen[(i + 1) % screen.length];
      area2 += a.x * b.y - b.x * a.y;
    }
    if (area2 >= -0.04) return '';
  }
  const d = screen.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + 'Z';
  const op = opts?.opacity !== undefined && opts.opacity < 0.995 ? ` fill-opacity="${opts.opacity.toFixed(2)}"` : '';
  const st = opts?.stroke
    ? ` stroke="${opts.stroke}" stroke-width="${(opts.strokeWidth ?? 0.45).toFixed(2)}" stroke-linejoin="round"`
    : '';
  return `<path d="${d}" fill="${fill}"${op}${st}/>`;
}

function toCam(pose: VehicleCameraPose, lx: number, ly: number, lz: number): Vec3Cam {
  return {
    x: pose.center.x + pose.right.x * lx + pose.forward.x * lz,
    z: pose.center.z + pose.right.z * lx + pose.forward.z * lz,
    height: ly,
  };
}

function distSq(p: Vec3Cam): number {
  const dy = p.height - CAR_CAMERA.heightM;
  return p.x * p.x + dy * dy + p.z * p.z;
}

/** Ground contact shadow under a vehicle (always visible on the road plane). */
function renderGroundShadow(pose: VehicleCameraPose, halfW: number, rearZ: number, frontZ: number, opacity = 0.44): string {
  const pts = [
    toCam(pose, -halfW, 0.005, rearZ),
    toCam(pose, halfW, 0.005, rearZ),
    toCam(pose, halfW, 0.005, frontZ),
    toCam(pose, -halfW, 0.005, frontZ),
  ];
  return polyFace(pts, '#050b13', { opacity, cull: false });
}

/**
 * True 3D perspective wheel (tire tread band + outer sidewall octagon + alloy/steel rim).
 * Foreshortens naturally from pure rear view (showing tire tread width) to side/oblique views
 * (showing circular/elliptical tire sidewall & rim).
 */
function renderWheel3D(
  pose: VehicleCameraPose,
  sideSign: -1 | 1,
  outerX: number,
  axleZ: number,
  radius: number,
  tireWidth: number,
  rimColor = '#9aa8b2',
): { depth: number; svg: string } {
  const innerX = outerX - sideSign * tireWidth;
  const center = toCam(pose, (outerX + innerX) * 0.5, radius, axleZ);
  if (center.z < CAR_CAMERA.near) return { depth: distSq(center), svg: '' };

  const N = 8;
  const outerRing: Vec3Cam[] = [];
  const innerRing: Vec3Cam[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const cz = axleZ + Math.cos(a) * radius;
    const cy = radius + Math.sin(a) * radius;
    outerRing.push(toCam(pose, outerX, cy, cz));
    innerRing.push(toCam(pose, innerX, cy, cz));
  }

  let svg = '';
  // Tire tread quads around circumference (outward normal radially away from axle)
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const quad =
      sideSign === 1
        ? [innerRing[i], outerRing[i], outerRing[j], innerRing[j]]
        : [outerRing[i], innerRing[i], innerRing[j], outerRing[j]];
    svg += polyFace(quad, i % 2 === 0 ? '#141c24' : '#19232c', { stroke: '#141c24', strokeWidth: 0.25 });
  }

  // Outer sidewall (visible when viewing that side of the vehicle)
  const sidewallPts = sideSign === 1 ? outerRing : [...outerRing].reverse();
  const sidewall = polyFace(sidewallPts, '#1b252e', { stroke: '#0f161c', strokeWidth: 0.35 });
  if (sidewall) {
    svg += sidewall;
    const rimR = radius * 0.6;
    const hubR = radius * 0.22;
    const rimPts: Vec3Cam[] = [];
    const hubPts: Vec3Cam[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      rimPts.push(toCam(pose, outerX + sideSign * 0.004, radius + Math.sin(a) * rimR, axleZ + Math.cos(a) * rimR));
      hubPts.push(toCam(pose, outerX + sideSign * 0.008, radius + Math.sin(a) * hubR, axleZ + Math.cos(a) * hubR));
    }
    svg += polyFace(sideSign === 1 ? rimPts : rimPts.reverse(), rimColor, { stroke: '#4d5b66', strokeWidth: 0.3 });
    svg += polyFace(sideSign === 1 ? hubPts : hubPts.reverse(), '#38454f');
  }

  return { depth: distSq(center), svg };
}

interface ProfileSection {
  z: number;
  w: number;
  yBot: number;
  yTop: number;
}

/**
 * Builds a closed, convex-like extruded 3D loft from rear-to-front cross sections,
 * with back-face culled rear cap, front cap, left/right side strips, and top deck strips.
 */
function buildLoft(
  pose: VehicleCameraPose,
  sections: ProfileSection[],
  palette: Palette,
  seamStroke = '#202c36',
): {
  svg: string;
  rearVisible: boolean;
  frontVisible: boolean;
  leftVisible: boolean;
  rightVisible: boolean;
} {
  let svg = '';
  let rearVisible = false;
  let frontVisible = false;
  let leftVisible = false;
  let rightVisible = false;

  const first = sections[0];
  const last = sections[sections.length - 1];

  // Rear cap (z = first.z, outward -z)
  const rearCap = polyFace(
    [
      toCam(pose, -first.w, first.yBot, first.z),
      toCam(pose, first.w, first.yBot, first.z),
      toCam(pose, first.w, first.yTop, first.z),
      toCam(pose, -first.w, first.yTop, first.z),
    ],
    palette.rear,
    { stroke: seamStroke, strokeWidth: 0.4 },
  );
  if (rearCap) {
    rearVisible = true;
    svg += rearCap;
  }

  // Front cap (z = last.z, outward +z)
  const frontCap = polyFace(
    [
      toCam(pose, last.w, last.yBot, last.z),
      toCam(pose, -last.w, last.yBot, last.z),
      toCam(pose, -last.w, last.yTop, last.z),
      toCam(pose, last.w, last.yTop, last.z),
    ],
    palette.front,
    { stroke: seamStroke, strokeWidth: 0.4 },
  );
  if (frontCap) {
    frontVisible = true;
    svg += frontCap;
  }

  // Segment side walls and top surfaces (stroke matches fill to seal sub-pixel SVG edges without vertical stripe artifacts)
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i];
    const b = sections[i + 1];

    // Right side (+w, outward +x): rear->front along bottom, then up, then back
    const rFace = polyFace(
      [
        toCam(pose, a.w, a.yBot, a.z),
        toCam(pose, b.w, b.yBot, b.z),
        toCam(pose, b.w, b.yTop, b.z),
        toCam(pose, a.w, a.yTop, a.z),
      ],
      palette.sideDark,
      { stroke: palette.sideDark, strokeWidth: 0.35 },
    );
    if (rFace) {
      rightVisible = true;
      svg += rFace;
    }

    // Left side (-w, outward -x): front->rear along bottom, then up, then forward
    const lFace = polyFace(
      [
        toCam(pose, -b.w, b.yBot, b.z),
        toCam(pose, -a.w, a.yBot, a.z),
        toCam(pose, -a.w, a.yTop, a.z),
        toCam(pose, -b.w, b.yTop, b.z),
      ],
      palette.sideLight,
      { stroke: palette.sideLight, strokeWidth: 0.35 },
    );
    if (lFace) {
      leftVisible = true;
      svg += lFace;
    }

    // Top surface (outward +y)
    svg += polyFace(
      [
        toCam(pose, -a.w, a.yTop, a.z),
        toCam(pose, a.w, a.yTop, a.z),
        toCam(pose, b.w, b.yTop, b.z),
        toCam(pose, -b.w, b.yTop, b.z),
      ],
      palette.top,
      { stroke: palette.top, strokeWidth: 0.3 },
    );
  }

  return { svg, rearVisible, frontVisible, leftVisible, rightVisible };
}

function renderPassengerVehicle3D(
  car: Pick<Vehicle, 'id' | 'kind' | 'direction' | 'braking' | 'lateral' | 'laneChange'>,
  time: number,
  pose: VehicleCameraPose,
): string {
  const palette = PAINTS[Math.abs(car.id) % PAINTS.length];
  const isSuv = car.kind === 'suv';
  const isVan = car.kind === 'van';

  const halfL = isVan ? 2.56 : isSuv ? 2.41 : 2.35;
  const halfW = isVan ? 0.99 : isSuv ? 0.98 : 0.94;
  const wheelR = isVan ? 0.36 : isSuv ? 0.39 : 0.34;
  const wheelAxleF = isVan ? 1.58 : isSuv ? 1.48 : 1.42;
  const wheelAxleR = isVan ? -1.56 : isSuv ? -1.44 : -1.42;
  const groundClear = isSuv ? 0.27 : isVan ? 0.23 : 0.20;
  const beltRear = isVan ? 1.04 : isSuv ? 1.05 : 0.94;
  const beltMid = isVan ? 1.02 : isSuv ? 1.01 : 0.90;
  const hoodTipY = isVan ? 0.86 : isSuv ? 0.90 : 0.74;
  const roofY = isVan ? 2.04 : isSuv ? 1.74 : 1.44;
  const roofW = isVan ? 0.88 : isSuv ? 0.80 : 0.72;
  const cabBaseW = halfW - 0.06;

  const blink = Boolean(car.laneChange && Math.floor(time * 2.5) % 2 === 0);
  // lateral > 0 means vehicle is sliding from left (+offset) rightward (-x in car frame -> +1 right indicator)
  const blinkSide: -1 | 1 | 0 = blink ? (car.lateral > 0 ? 1 : -1) : 0;

  let out = renderGroundShadow(pose, halfW + 0.08, -halfL - 0.06, halfL + 0.06, 0.46);

  // Compute all 4 wheels; draw far-side wheels behind the body and near-side wheels alongside/after lower body
  const wheels: { side: -1 | 1; depth: number; svg: string }[] = [];
  for (const side of [-1, 1] as const) {
    for (const az of [wheelAxleR, wheelAxleF]) {
      const w = renderWheel3D(pose, side, side * (halfW - 0.02), az, wheelR, isSuv ? 0.25 : 0.22);
      wheels.push({ side, ...w });
    }
  }
  wheels.sort((a, b) => b.depth - a.depth);
  // Check which lateral side of the vehicle faces the camera
  const viewSideDot =
    pose.right.x * pose.center.x + pose.right.z * pose.center.z;
  // If center is to the right of camera (viewSideDot > 0 when forward=+z), left side (-1) faces camera
  const nearSide: -1 | 1 = viewSideDot > 0 ? -1 : 1;

  for (const w of wheels) {
    if (w.side !== nearSide) out += w.svg;
  }

  // Lower body tub (bumper -> rear quarter -> passenger doors -> front fender -> nose)
  const bodySections: ProfileSection[] = isVan
    ? [
        { z: -halfL, w: halfW - 0.04, yBot: groundClear + 0.04, yTop: beltRear },
        { z: -1.6, w: halfW, yBot: groundClear, yTop: beltMid },
        { z: 1.55, w: halfW, yBot: groundClear, yTop: beltMid },
        { z: 2.25, w: halfW - 0.03, yBot: groundClear + 0.02, yTop: 0.94 },
        { z: halfL, w: halfW - 0.09, yBot: groundClear + 0.05, yTop: hoodTipY },
      ]
    : [
        { z: -halfL, w: halfW - 0.06, yBot: groundClear + 0.05, yTop: beltRear - 0.03 },
        { z: -1.95, w: halfW, yBot: groundClear + 0.02, yTop: beltRear },
        { z: -0.6, w: halfW, yBot: groundClear, yTop: beltMid },
        { z: 1.15, w: halfW, yBot: groundClear, yTop: beltMid - 0.02 },
        { z: 2.05, w: halfW - 0.04, yBot: groundClear + 0.02, yTop: hoodTipY + 0.07 },
        { z: halfL, w: halfW - 0.11, yBot: groundClear + 0.06, yTop: hoodTipY },
      ];

  const lower = buildLoft(pose, bodySections, palette);
  out += lower.svg;

  // Lower rocker / SUV rugged dark cladding strip on visible side
  for (const side of [-1, 1] as const) {
    const isRight = side === 1;
    if ((isRight && !lower.rightVisible) || (!isRight && !lower.leftVisible)) continue;
    const sx = side * (halfW + 0.003);
    const cladH = isSuv ? groundClear + 0.13 : groundClear + 0.06;
    const pts = isRight
      ? [
          toCam(pose, sx, groundClear, -1.9),
          toCam(pose, sx, groundClear, 1.95),
          toCam(pose, sx, cladH, 1.95),
          toCam(pose, sx, cladH, -1.9),
        ]
      : [
          toCam(pose, sx, groundClear, 1.95),
          toCam(pose, sx, groundClear, -1.9),
          toCam(pose, sx, cladH, -1.9),
          toCam(pose, sx, cladH, 1.95),
        ];
    out += polyFace(pts, '#1b242c');
  }

  // Near-side wheels sit cleanly in the wheel arches
  for (const w of wheels) {
    if (w.side === nearSide) out += w.svg;
  }

  //Rear fascia details on lower body (bumper valence, license plate, taillights, turn signals)
  if (lower.rearVisible) {
    const rz = -halfL - 0.006;
    // Lower dark diffuser / SUV silver skid plate
    out += polyFace(
      [
        toCam(pose, -halfW + 0.10, groundClear + 0.05, rz),
        toCam(pose, halfW - 0.10, groundClear + 0.05, rz),
        toCam(pose, halfW - 0.08, groundClear + 0.18, rz),
        toCam(pose, -halfW + 0.08, groundClear + 0.18, rz),
      ],
      isSuv ? '#7c8993' : '#1b242d',
    );
    // License plate recess + plate
    const plateY0 = groundClear + (isVan ? 0.26 : 0.24);
    out += polyFace(
      [
        toCam(pose, -0.20, plateY0, rz - 0.003),
        toCam(pose, 0.20, plateY0, rz - 0.003),
        toCam(pose, 0.20, plateY0 + 0.12, rz - 0.003),
        toCam(pose, -0.20, plateY0 + 0.12, rz - 0.003),
      ],
      '#dce3e6',
      { stroke: '#46545e', strokeWidth: 0.3 },
    );

    // Tail / brake lights
    const tailColor = car.braking ? '#ff3b3f' : '#a8242c';
    const tailInner = car.braking ? '#ff9488' : '#cf3842';
    const lampTop = beltRear - 0.06;
    const lampBot = beltRear - (isVan ? 0.36 : isSuv ? 0.24 : 0.19);
    const lampInW = isVan ? 0.76 : 0.50;
    const lampOutW = halfW - 0.07;
    for (const s of [-1, 1] as const) {
      const x0 = s === -1 ? -lampOutW : lampInW;
      const x1 = s === -1 ? -lampInW : lampOutW;
      out += polyFace(
        [
          toCam(pose, x0, lampBot, rz - 0.004),
          toCam(pose, x1, lampBot, rz - 0.004),
          toCam(pose, x1, lampTop, rz - 0.004),
          toCam(pose, x0, lampTop, rz - 0.004),
        ],
        tailColor,
      );
      // Bright LED light-bar core
      const coreY0 = lampBot + (lampTop - lampBot) * 0.35;
      const coreY1 = lampTop - (lampTop - lampBot) * 0.2;
      out += polyFace(
        [
          toCam(pose, x0 + 0.02, coreY0, rz - 0.007),
          toCam(pose, x1 - 0.02, coreY0, rz - 0.007),
          toCam(pose, x1 - 0.02, coreY1, rz - 0.007),
          toCam(pose, x0 + 0.02, coreY1, rz - 0.007),
        ],
        tailInner,
      );
    }
    // Rear amber turn indicator when changing lanes
    if (blinkSide !== 0) {
      const ix0 = blinkSide === -1 ? -lampOutW : lampOutW - 0.16;
      const ix1 = blinkSide === -1 ? -lampOutW + 0.16 : lampOutW;
      out += polyFace(
        [
          toCam(pose, ix0, lampBot - 0.06, rz - 0.008),
          toCam(pose, ix1, lampBot - 0.06, rz - 0.008),
          toCam(pose, ix1, lampBot + 0.02, rz - 0.008),
          toCam(pose, ix0, lampBot + 0.02, rz - 0.008),
        ],
        '#ffb938',
      );
    }
  }

  // Front fascia details (grille, lower intake, LED headlights, front turn signal)
  if (lower.frontVisible) {
    const fz = halfL + 0.006;
    // Upper radiator grille
    out += polyFace(
      [
        toCam(pose, 0.46, groundClear + 0.20, fz),
        toCam(pose, -0.46, groundClear + 0.20, fz),
        toCam(pose, -0.42, hoodTipY - 0.06, fz),
        toCam(pose, 0.42, hoodTipY - 0.06, fz),
      ],
      '#151e26',
      { stroke: '#5d6c78', strokeWidth: 0.35 },
    );
    // Lower air intake / skid trim
    out += polyFace(
      [
        toCam(pose, 0.58, groundClear + 0.06, fz),
        toCam(pose, -0.58, groundClear + 0.06, fz),
        toCam(pose, -0.52, groundClear + 0.14, fz),
        toCam(pose, 0.52, groundClear + 0.14, fz),
      ],
      isSuv ? '#85939d' : '#121920',
    );
    // Headlights
    const hlTop = hoodTipY - 0.03;
    const hlBot = hoodTipY - 0.16;
    for (const s of [-1, 1] as const) {
      const xOuter = s * (halfW - 0.11);
      const xInner = s * 0.48;
      const pts =
        s === 1
          ? [
              toCam(pose, xOuter, hlBot, fz + 0.003),
              toCam(pose, xInner, hlBot + 0.01, fz + 0.003),
              toCam(pose, xInner, hlTop - 0.01, fz + 0.003),
              toCam(pose, xOuter, hlTop, fz + 0.003),
            ]
          : [
              toCam(pose, xInner, hlBot + 0.01, fz + 0.003),
              toCam(pose, xOuter, hlBot, fz + 0.003),
              toCam(pose, xOuter, hlTop, fz + 0.003),
              toCam(pose, xInner, hlTop - 0.01, fz + 0.003),
            ];
      out += polyFace(pts, '#f5f1df', { stroke: '#9fb4c4', strokeWidth: 0.25 });
    }
    if (blinkSide !== 0) {
      const bx0 = blinkSide * (halfW - 0.11);
      const bx1 = blinkSide * (halfW - 0.25);
      const pts =
        blinkSide === 1
          ? [
              toCam(pose, bx0, hlBot - 0.06, fz + 0.005),
              toCam(pose, bx1, hlBot - 0.06, fz + 0.005),
              toCam(pose, bx1, hlBot, fz + 0.005),
              toCam(pose, bx0, hlBot, fz + 0.005),
            ]
          : [
              toCam(pose, bx1, hlBot - 0.06, fz + 0.005),
              toCam(pose, bx0, hlBot - 0.06, fz + 0.005),
              toCam(pose, bx0, hlBot, fz + 0.005),
              toCam(pose, bx1, hlBot, fz + 0.005),
            ];
      out += polyFace(pts, '#ffb938');
    }
  }

  // Upper Greenhouse / Cabin (tapered roof & sloped windshield / backlight)
  const cabRearBaseZ = isVan ? -halfL + 0.04 : isSuv ? -halfL + 0.10 : -1.52;
  const cabRearTopZ = isVan ? -halfL + 0.14 : isSuv ? -halfL + 0.48 : -0.88;
  const cabFrontTopZ = isVan ? 1.05 : isSuv ? 0.56 : 0.42;
  const cabFrontBaseZ = isVan ? 1.85 : isSuv ? 1.25 : 1.15;
  const cabBaseY = beltMid - 0.01;

  // Rear sloped backlight / tailgate surface (outward normal -z, +y)
  const rearCabPts = [
    toCam(pose, -cabBaseW, isVan || isSuv ? beltRear - 0.02 : cabBaseY, cabRearBaseZ),
    toCam(pose, cabBaseW, isVan || isSuv ? beltRear - 0.02 : cabBaseY, cabRearBaseZ),
    toCam(pose, roofW, roofY, cabRearTopZ),
    toCam(pose, -roofW, roofY, cabRearTopZ),
  ];
  const rearCabFace = polyFace(rearCabPts, palette.rear, { stroke: '#202c36', strokeWidth: 0.35 });
  if (rearCabFace) {
    out += rearCabFace;
    // Inset rear tinted window
    const gw0 = cabBaseW - 0.10;
    const gw1 = roofW - 0.08;
    const gy0 = (isVan || isSuv ? beltRear : cabBaseY) + 0.05;
    const gy1 = roofY - 0.06;
    const t0 = 0.10;
    const t1 = 0.88;
    const gz0 = cabRearBaseZ + (cabRearTopZ - cabRearBaseZ) * t0 - 0.004;
    const gz1 = cabRearBaseZ + (cabRearTopZ - cabRearBaseZ) * t1 - 0.004;
    out += polyFace(
      [
        toCam(pose, -gw0, gy0, gz0),
        toCam(pose, gw0, gy0, gz0),
        toCam(pose, gw1, gy1, gz1),
        toCam(pose, -gw1, gy1, gz1),
      ],
      '#1c2e3a',
      { stroke: '#3a4e5c', strokeWidth: 0.25 },
    );
    if (isVan) {
      // Van rear barn-door center split
      out += polyFace(
        [
          toCam(pose, -0.018, groundClear + 0.18, cabRearBaseZ - 0.008),
          toCam(pose, 0.018, groundClear + 0.18, cabRearBaseZ - 0.008),
          toCam(pose, 0.018, roofY - 0.05, cabRearTopZ - 0.008),
          toCam(pose, -0.018, roofY - 0.05, cabRearTopZ - 0.008),
        ],
        '#25333d',
      );
    }
    // High-mount center stop lamp (CHMSL) when braking
    if (car.braking) {
      const chZ = cabRearBaseZ + (cabRearTopZ - cabRearBaseZ) * 0.92 - 0.008;
      out += polyFace(
        [
          toCam(pose, -0.22, roofY - 0.075, chZ),
          toCam(pose, 0.22, roofY - 0.075, chZ),
          toCam(pose, 0.22, roofY - 0.035, chZ),
          toCam(pose, -0.22, roofY - 0.035, chZ),
        ],
        '#ff5252',
      );
    }
  }

  // Front sloped windshield + A-pillars (outward normal +z, +y)
  const frontCabPts = [
    toCam(pose, cabBaseW, cabBaseY, cabFrontBaseZ),
    toCam(pose, -cabBaseW, cabBaseY, cabFrontBaseZ),
    toCam(pose, -roofW, roofY, cabFrontTopZ),
    toCam(pose, roofW, roofY, cabFrontTopZ),
  ];
  const frontCabFace = polyFace(frontCabPts, palette.front, { stroke: '#202c36', strokeWidth: 0.35 });
  if (frontCabFace) {
    out += frontCabFace;
    const fw0 = cabBaseW - 0.09;
    const fw1 = roofW - 0.08;
    const fz0 = cabFrontBaseZ + (cabFrontTopZ - cabFrontBaseZ) * 0.08 + 0.004;
    const fz1 = cabFrontBaseZ + (cabFrontTopZ - cabFrontBaseZ) * 0.90 + 0.004;
    out += polyFace(
      [
        toCam(pose, fw0, cabBaseY + 0.04, fz0),
        toCam(pose, -fw0, cabBaseY + 0.04, fz0),
        toCam(pose, -fw1, roofY - 0.05, fz1),
        toCam(pose, fw1, roofY - 0.05, fz1),
      ],
      '#1d313f',
      { stroke: '#415766', strokeWidth: 0.25 },
    );
  }

  // Left & Right cabin side panels + side windows & B-pillar
  for (const side of [-1, 1] as const) {
    const isRight = side === 1;
    const sideColor = isRight ? palette.sideDark : palette.sideLight;
    const sidePts = isRight
      ? [
          toCam(pose, cabBaseW, cabBaseY, cabRearBaseZ),
          toCam(pose, cabBaseW, cabBaseY, cabFrontBaseZ),
          toCam(pose, roofW, roofY, cabFrontTopZ),
          toCam(pose, roofW, roofY, cabRearTopZ),
        ]
      : [
          toCam(pose, -cabBaseW, cabBaseY, cabFrontBaseZ),
          toCam(pose, -cabBaseW, cabBaseY, cabRearBaseZ),
          toCam(pose, -roofW, roofY, cabRearTopZ),
          toCam(pose, -roofW, roofY, cabFrontTopZ),
        ];
    const cabSide = polyFace(sidePts, sideColor, { stroke: '#202c36', strokeWidth: 0.35 });
    if (cabSide) {
      out += cabSide;
      // Inset dark side glass band
      const bx0 = side * (cabBaseW + 0.003);
      const bx1 = side * (roofW + 0.015);
      const gzRearBot = cabRearBaseZ + 0.16;
      const gzRearTop = cabRearTopZ + 0.10;
      const gzFrontBot = cabFrontBaseZ - 0.14;
      const gzFrontTop = cabFrontTopZ - 0.08;
      const gyBot = cabBaseY + 0.05;
      const gyTop = roofY - 0.065;
      const winPts = isRight
        ? [
            toCam(pose, bx0, gyBot, gzRearBot),
            toCam(pose, bx0, gyBot, gzFrontBot),
            toCam(pose, bx1, gyTop, gzFrontTop),
            toCam(pose, bx1, gyTop, gzRearTop),
          ]
        : [
            toCam(pose, bx0, gyBot, gzFrontBot),
            toCam(pose, bx0, gyBot, gzRearBot),
            toCam(pose, bx1, gyTop, gzRearTop),
            toCam(pose, bx1, gyTop, gzFrontTop),
          ];
      out += polyFace(winPts, '#1a2c38', { stroke: '#324654', strokeWidth: 0.25 });

      // B-pillar divider
      const bpBotZ = -0.05;
      const bpTopZ = -0.10;
      const bpPts = isRight
        ? [
            toCam(pose, bx0 + 0.002, gyBot, bpBotZ - 0.05),
            toCam(pose, bx0 + 0.002, gyBot, bpBotZ + 0.05),
            toCam(pose, bx1 + 0.002, gyTop, bpTopZ + 0.04),
            toCam(pose, bx1 + 0.002, gyTop, bpTopZ - 0.04),
          ]
        : [
            toCam(pose, bx0 - 0.002, gyBot, bpBotZ + 0.05),
            toCam(pose, bx0 - 0.002, gyBot, bpBotZ - 0.05),
            toCam(pose, bx1 - 0.002, gyTop, bpTopZ - 0.04),
            toCam(pose, bx1 - 0.002, gyTop, bpTopZ + 0.04),
          ];
      out += polyFace(bpPts, '#131d25');

      // Side mirror housing
      const mxIn = side * (halfW - 0.02);
      const mxOut = side * (halfW + 0.12);
      const mz = cabFrontBaseZ - 0.28;
      out += polyFace(
        isRight
          ? [
              toCam(pose, mxIn, cabBaseY + 0.03, mz - 0.08),
              toCam(pose, mxOut, cabBaseY + 0.04, mz - 0.05),
              toCam(pose, mxOut, cabBaseY + 0.13, mz - 0.05),
              toCam(pose, mxIn, cabBaseY + 0.12, mz - 0.08),
            ]
          : [
              toCam(pose, mxOut, cabBaseY + 0.04, mz - 0.05),
              toCam(pose, mxIn, cabBaseY + 0.03, mz - 0.08),
              toCam(pose, mxIn, cabBaseY + 0.12, mz - 0.08),
              toCam(pose, mxOut, cabBaseY + 0.13, mz - 0.05),
            ],
        sideColor,
        { stroke: '#1d2832', strokeWidth: 0.25 },
      );
    }
  }

  // Roof panel (automatically culled if roofY > camera eye height 1.65 m, e.g. SUV/Van!)
  out += polyFace(
    [
      toCam(pose, -roofW, roofY, cabRearTopZ),
      toCam(pose, roofW, roofY, cabRearTopZ),
      toCam(pose, roofW, roofY, cabFrontTopZ),
      toCam(pose, -roofW, roofY, cabFrontTopZ),
    ],
    palette.top,
    { stroke: '#25333e', strokeWidth: 0.3 },
  );

  // SUV roof rails (thin raised bars along roof edges)
  if (isSuv) {
    for (const s of [-1, 1] as const) {
      const rx = s * (roofW - 0.06);
      out += polyFace(
        s === 1
          ? [
              toCam(pose, rx, roofY, cabRearTopZ + 0.12),
              toCam(pose, rx, roofY, cabFrontTopZ - 0.12),
              toCam(pose, rx, roofY + 0.055, cabFrontTopZ - 0.18),
              toCam(pose, rx, roofY + 0.055, cabRearTopZ + 0.18),
            ]
          : [
              toCam(pose, rx, roofY, cabFrontTopZ - 0.12),
              toCam(pose, rx, roofY, cabRearTopZ + 0.12),
              toCam(pose, rx, roofY + 0.055, cabRearTopZ + 0.18),
              toCam(pose, rx, roofY + 0.055, cabFrontTopZ - 0.18),
            ],
        '#5d6c76',
        { cull: false },
      );
    }
  }

  return out;
}

/**
 * Full 17 m 18-wheeler tractor-trailer in metric 3D perspective:
 * - Separate tractor cab + hood + chassis/5-axles + 53' dry-van trailer volumes
 * - Sorted back-to-front by camera distance so oncoming vs same-way occlusion is always exact
 * - Back-face culling prevents the 3.95 m trailer roof (above 1.65 m eye height) from ever rendering inside-out!
 */
function renderSemiTruck3D(
  car: Pick<Vehicle, 'id' | 'kind' | 'direction' | 'braking' | 'lateral' | 'laneChange'>,
  time: number,
  pose: VehicleCameraPose,
): string {
  const cabPalette = CAB_PAINTS[Math.abs(car.id) % CAB_PAINTS.length];
  const trailerPalette: Palette = {
    top: '#eef1f2',
    front: '#d8dfe2',
    rear: '#cfd6d9',
    sideLight: '#e3e8ea',
    sideDark: '#bac4c8',
  };
  const chassisPalette: Palette = {
    top: '#242f38',
    front: '#1c252d',
    rear: '#192128',
    sideLight: '#222c35',
    sideDark: '#171f26',
  };

  const blink = Boolean(car.laneChange && Math.floor(time * 2.5) % 2 === 0);
  const blinkSide: -1 | 1 | 0 = blink ? (car.lateral > 0 ? 1 : -1) : 0;

  let out = renderGroundShadow(pose, 1.34, -8.55, 8.55, 0.5);

  const viewSideDot = pose.right.x * pose.center.x + pose.right.z * pose.center.z;
  const nearSide: -1 | 1 = viewSideDot > 0 ? -1 : 1;

  // 5 axles (trailer tandem: -6.9, -5.6; tractor tandem: 3.3, 4.6; steer: 7.2)
  const axles = [-6.9, -5.6, 3.3, 4.6, 7.2];
  const wheels: { side: -1 | 1; depth: number; svg: string }[] = [];
  for (const side of [-1, 1] as const) {
    for (const az of axles) {
      const isSteer = az > 6.5;
      const w = renderWheel3D(pose, side, side * (isSteer ? 1.18 : 1.23), az, 0.50, isSteer ? 0.28 : 0.48, '#8d9aa3');
      wheels.push({ side, ...w });
    }
  }
  wheels.sort((a, b) => b.depth - a.depth);
  for (const w of wheels) {
    if (w.side !== nearSide) out += w.svg;
  }

  // Chassis rails + fifth wheel + fuel tanks under cab/trailer
  out += buildLoft(
    pose,
    [
      { z: -7.6, w: 0.92, yBot: 0.48, yTop: 1.12 },
      { z: 7.9, w: 0.92, yBot: 0.48, yTop: 1.06 },
    ],
    chassisPalette,
    '#141c22',
  ).svg;

  for (const w of wheels) {
    if (w.side === nearSide) out += w.svg;
  }

  // Build trailer volume (z = -8.5 .. +4.35, w = 1.27, y = 1.16 .. 3.95)
  const buildTrailer = () => {
    const tr = buildLoft(
      pose,
      [
        { z: -8.5, w: 1.27, yBot: 1.16, yTop: 3.95 },
        { z: 4.35, w: 1.27, yBot: 1.16, yTop: 3.95 },
      ],
      trailerPalette,
      '#697780',
    );
    let s = tr.svg;

    // Visible trailer side details: subtle rib seams + DOT red/white conspicuity stripe
    for (const side of [-1, 1] as const) {
      const isRight = side === 1;
      if ((isRight && !tr.rightVisible) || (!isRight && !tr.leftVisible)) continue;
      const sx = side * 1.274;
      // Lower rub-rail + DOT reflective tape segments
      for (let z = -8.2; z < 4.0; z += 1.25) {
        const zEnd = Math.min(4.1, z + 0.72);
        const redPts = isRight
          ? [toCam(pose, sx, 1.20, z), toCam(pose, sx, 1.20, zEnd), toCam(pose, sx, 1.29, zEnd), toCam(pose, sx, 1.29, z)]
          : [toCam(pose, sx, 1.20, zEnd), toCam(pose, sx, 1.20, z), toCam(pose, sx, 1.29, z), toCam(pose, sx, 1.29, zEnd)];
        s += polyFace(redPts, '#c93b3b');
      }
      // Subtle vertical panel ribs
      for (let z = -7.0; z <= 3.0; z += 2.0) {
        const ribPts = isRight
          ? [toCam(pose, sx, 1.34, z), toCam(pose, sx, 1.34, z + 0.06), toCam(pose, sx, 3.86, z + 0.06), toCam(pose, sx, 3.86, z)]
          : [toCam(pose, sx, 1.34, z + 0.06), toCam(pose, sx, 1.34, z), toCam(pose, sx, 3.86, z), toCam(pose, sx, 3.86, z + 0.06)];
        s += polyFace(ribPts, '#9aa7ae', { opacity: 0.55 });
      }
    }

    // Rear barn doors, locking bars, Mansfield underride bar & brake/turn lamps
    if (tr.rearVisible) {
      const rz = -8.508;
      // Center barn-door seam + twin locking rods
      for (const lx of [-0.46, 0, 0.46]) {
        const w = lx === 0 ? 0.022 : 0.018;
        s += polyFace(
          [
            toCam(pose, lx - w, 1.22, rz),
            toCam(pose, lx + w, 1.22, rz),
            toCam(pose, lx + w, 3.88, rz),
            toCam(pose, lx - w, 3.88, rz),
          ],
          lx === 0 ? '#5c6a73' : '#8b99a1',
        );
      }
      // DOT red/white conspicuity bar across lower doors
      for (let x = -1.18; x < 1.1; x += 0.48) {
        s += polyFace(
          [
            toCam(pose, x, 1.20, rz - 0.002),
            toCam(pose, x + 0.28, 1.20, rz - 0.002),
            toCam(pose, x + 0.28, 1.29, rz - 0.002),
            toCam(pose, x, 1.29, rz - 0.002),
          ],
          '#d13b3b',
        );
      }
      // Top clearance marker LEDs
      for (const mx of [-1.08, -0.18, 0, 0.18, 1.08]) {
        s += polyFace(
          [
            toCam(pose, mx - 0.04, 3.84, rz - 0.002),
            toCam(pose, mx + 0.04, 3.84, rz - 0.002),
            toCam(pose, mx + 0.04, 3.90, rz - 0.002),
            toCam(pose, mx - 0.04, 3.90, rz - 0.002),
          ],
          '#ff4f45',
        );
      }
      // Steel Mansfield underride guard bumper + vertical struts
      for (const sx of [-0.82, 0.82]) {
        s += polyFace(
          [
            toCam(pose, sx - 0.06, 0.56, rz + 0.02),
            toCam(pose, sx + 0.06, 0.56, rz + 0.02),
            toCam(pose, sx + 0.06, 1.16, rz + 0.02),
            toCam(pose, sx - 0.06, 1.16, rz + 0.02),
          ],
          '#5b6870',
        );
      }
      s += polyFace(
        [
          toCam(pose, -1.16, 0.52, rz),
          toCam(pose, 1.16, 0.52, rz),
          toCam(pose, 1.16, 0.66, rz),
          toCam(pose, -1.16, 0.66, rz),
        ],
        '#7f8d96',
        { stroke: '#39454d', strokeWidth: 0.3 },
      );
      // Tail / brake light clusters
      const lampCol = car.braking ? '#ff3b3f' : '#9e232a';
      for (const side of [-1, 1] as const) {
        const x0 = side === -1 ? -1.15 : 0.78;
        const x1 = side === -1 ? -0.78 : 1.15;
        s += polyFace(
          [
            toCam(pose, x0, 0.92, rz - 0.003),
            toCam(pose, x1, 0.92, rz - 0.003),
            toCam(pose, x1, 1.08, rz - 0.003),
            toCam(pose, x0, 1.08, rz - 0.003),
          ],
          lampCol,
        );
      }
      if (blinkSide !== 0) {
        const bx0 = blinkSide === -1 ? -1.22 : 1.08;
        const bx1 = blinkSide === -1 ? -1.08 : 1.22;
        s += polyFace(
          [
            toCam(pose, bx0, 0.92, rz - 0.005),
            toCam(pose, bx1, 0.92, rz - 0.005),
            toCam(pose, bx1, 1.08, rz - 0.005),
            toCam(pose, bx0, 1.08, rz - 0.005),
          ],
          '#ffb938',
        );
      }
    }
    return s;
  };

  // Build aerodynamic conventional tractor cab + hood (z = 4.65 .. 8.5)
  const buildTractor = () => {
    const cab = buildLoft(
      pose,
      [
        { z: 4.65, w: 1.22, yBot: 1.02, yTop: 3.78 },
        { z: 5.85, w: 1.20, yBot: 1.02, yTop: 3.56 },
        { z: 6.55, w: 1.16, yBot: 0.98, yTop: 2.75 },
        { z: 6.95, w: 1.12, yBot: 0.92, yTop: 1.88 },
        { z: 8.45, w: 1.06, yBot: 0.46, yTop: 1.62 },
      ],
      cabPalette,
      '#1d2a34',
    );
    let s = cab.svg;

    // Raked cab windshield (between z=6.92, y=1.90 and z=6.55, y=2.66)
    s += polyFace(
      [
        toCam(pose, 1.02, 1.92, 6.94),
        toCam(pose, -1.02, 1.92, 6.94),
        toCam(pose, -0.98, 2.64, 6.57),
        toCam(pose, 0.98, 2.64, 6.57),
      ],
      '#1a2e3b',
      { stroke: '#425868', strokeWidth: 0.3 },
    );

    // Side cab windows + aluminum fuel tanks
    for (const side of [-1, 1] as const) {
      const isRight = side === 1;
      if ((isRight && !cab.rightVisible) || (!isRight && !cab.leftVisible)) continue;
      const wx = side * 1.185;
      const winPts = isRight
        ? [toCam(pose, wx, 1.92, 5.88), toCam(pose, wx, 1.92, 6.82), toCam(pose, wx * 0.98, 2.62, 6.52), toCam(pose, wx * 0.99, 2.66, 5.88)]
        : [toCam(pose, wx, 1.92, 6.82), toCam(pose, wx, 1.92, 5.88), toCam(pose, wx * 0.99, 2.66, 5.88), toCam(pose, wx * 0.98, 2.62, 6.52)];
      s += polyFace(winPts, '#1a2e3b', { stroke: '#3c505e', strokeWidth: 0.25 });

      // Side aluminum fuel tank
      const tx = side * 1.16;
      const tankPts = isRight
        ? [toCam(pose, tx, 0.56, 5.05), toCam(pose, tx, 0.56, 6.45), toCam(pose, tx, 0.98, 6.45), toCam(pose, tx, 0.98, 5.05)]
        : [toCam(pose, tx, 0.56, 6.45), toCam(pose, tx, 0.56, 5.05), toCam(pose, tx, 0.98, 5.05), toCam(pose, tx, 0.98, 6.45)];
      s += polyFace(tankPts, '#9ba8b0', { stroke: '#55636b', strokeWidth: 0.25 });
    }

    // Front chrome grille, heavy bumper & headlights
    if (cab.frontVisible) {
      const fz = 8.46;
      // Chrome grille surround + dark vertical louvers
      s += polyFace(
        [
          toCam(pose, 0.62, 0.78, fz),
          toCam(pose, -0.62, 0.78, fz),
          toCam(pose, -0.58, 1.54, fz),
          toCam(pose, 0.58, 1.54, fz),
        ],
        '#202b34',
        { stroke: '#cfd8de', strokeWidth: 0.55 },
      );
      // Heavy chrome front bumper
      s += polyFace(
        [
          toCam(pose, 1.12, 0.42, fz + 0.02),
          toCam(pose, -1.12, 0.42, fz + 0.02),
          toCam(pose, -1.12, 0.72, fz + 0.02),
          toCam(pose, 1.12, 0.72, fz + 0.02),
        ],
        '#bfc9cf',
        { stroke: '#56646d', strokeWidth: 0.3 },
      );
      // Headlights
      for (const side of [-1, 1] as const) {
        const xOut = side * 1.03;
        const xIn = side * 0.68;
        s += polyFace(
          side === 1
            ? [toCam(pose, xOut, 0.78, fz + 0.01), toCam(pose, xIn, 0.78, fz + 0.01), toCam(pose, xIn, 0.98, fz + 0.01), toCam(pose, xOut, 0.98, fz + 0.01)]
            : [toCam(pose, xIn, 0.78, fz + 0.01), toCam(pose, xOut, 0.78, fz + 0.01), toCam(pose, xOut, 0.98, fz + 0.01), toCam(pose, xIn, 0.98, fz + 0.01)],
          '#f6f1dd',
        );
      }
    }
    return s;
  };

  // Painter-sort trailer vs tractor by 3D distance to each volume's center
  const trailerCenter = toCam(pose, 0, 2.4, -2.0);
  const tractorCenter = toCam(pose, 0, 2.0, 6.5);
  if (distSq(tractorCenter) > distSq(trailerCenter)) {
    out += buildTractor() + buildTrailer();
  } else {
    out += buildTrailer() + buildTractor();
  }
  return out;
}

function renderMotorcycle3D(
  car: Pick<Vehicle, 'id' | 'kind' | 'direction' | 'braking' | 'lateral' | 'laneChange'>,
  time: number,
  pose: VehicleCameraPose,
): string {
  const palette = PAINTS[Math.abs(car.id) % PAINTS.length];
  const blink = Boolean(car.laneChange && Math.floor(time * 2.5) % 2 === 0);
  const blinkSide: -1 | 1 | 0 = blink ? (car.lateral > 0 ? 1 : -1) : 0;

  let out = renderGroundShadow(pose, 0.34, -1.05, 1.05, 0.42);

  const viewSideDot = pose.right.x * pose.center.x + pose.right.z * pose.center.z;
  const nearSide: -1 | 1 = viewSideDot > 0 ? -1 : 1;

  // Rear & front inline wheels sorted back-to-front with visible sidewall facing camera
  const wRear = renderWheel3D(pose, nearSide, nearSide * 0.08, -0.72, 0.31, 0.16, '#7f8e99');
  const wFront = renderWheel3D(pose, nearSide, nearSide * 0.07, 0.74, 0.31, 0.14, '#7f8e99');
  const bikeBody = () => {
    const body = buildLoft(
      pose,
      [
        { z: -0.80, w: 0.12, yBot: 0.62, yTop: 0.84 },
        { z: -0.15, w: 0.21, yBot: 0.38, yTop: 0.88 },
        { z: 0.45, w: 0.23, yBot: 0.42, yTop: 1.04 },
        { z: 0.86, w: 0.13, yBot: 0.66, yTop: 0.96 },
      ],
      palette,
      '#1b2630',
    );
    let s = body.svg;
    if (body.rearVisible) {
      s += polyFace(
        [
          toCam(pose, -0.09, 0.73, -0.81),
          toCam(pose, 0.09, 0.73, -0.81),
          toCam(pose, 0.09, 0.81, -0.81),
          toCam(pose, -0.09, 0.81, -0.81),
        ],
        car.braking ? '#ff4448' : '#a8262e',
      );
      if (blinkSide !== 0) {
        const bx = blinkSide * 0.18;
        s += polyFace(
          [
            toCam(pose, bx - 0.04, 0.71, -0.79),
            toCam(pose, bx + 0.04, 0.71, -0.79),
            toCam(pose, bx + 0.04, 0.78, -0.79),
            toCam(pose, bx - 0.04, 0.78, -0.79),
          ],
          '#ffb938',
        );
      }
    }
    if (body.frontVisible) {
      s += polyFace(
        [
          toCam(pose, 0.09, 0.76, 0.87),
          toCam(pose, -0.09, 0.76, 0.87),
          toCam(pose, -0.07, 0.89, 0.87),
          toCam(pose, 0.07, 0.89, 0.87),
        ],
        '#f6f2df',
      );
    }
    // Tapered rider jacket & rounded aero helmet
    const jacket: Palette = {
      top: '#394652',
      front: '#2d3842',
      rear: '#263039',
      sideLight: '#33404b',
      sideDark: '#202931',
    };
    s += buildLoft(
      pose,
      [
        { z: -0.32, w: 0.16, yBot: 0.84, yTop: 1.24 },
        { z: -0.08, w: 0.21, yBot: 0.86, yTop: 1.35 },
        { z: 0.14, w: 0.17, yBot: 0.90, yTop: 1.34 },
      ],
      jacket,
      '#182028',
    ).svg;
    const hTop = car.id % 2 ? '#e5eaed' : '#354b5e';
    const hShade = car.id % 2 ? '#c2ccd2' : '#243544';
    s += buildLoft(
      pose,
      [
        { z: -0.10, w: 0.09, yBot: 1.40, yTop: 1.54 },
        { z: 0.02, w: 0.125, yBot: 1.36, yTop: 1.60 },
        { z: 0.15, w: 0.09, yBot: 1.39, yTop: 1.54 },
      ],
      { top: hTop, front: '#16232e', rear: hShade, sideLight: hTop, sideDark: hShade },
      '#1b2630',
    ).svg;
    return s;
  };

  if (wFront.depth > wRear.depth) {
    out += wFront.svg + bikeBody() + wRear.svg;
  } else {
    out += wRear.svg + bikeBody() + wFront.svg;
  }
  return out;
}

/**
 * Renders a traffic vehicle in true metric 3D perspective when given `pose` in camera space,
 * or from a canonical rear/front elevation pose at 18 m when called standalone in tests.
 */
export function trafficCarSvg(
  car: Pick<Vehicle, 'id' | 'kind' | 'direction' | 'braking' | 'lateral' | 'laneChange'>,
  time: number,
  pose?: VehicleCameraPose,
): string {
  const dir = car.direction === -1 ? -1 : 1;
  const resolvedPose: VehicleCameraPose = pose ?? {
    center: { x: 0, z: 18 },
    forward: { x: 0, z: dir },
    right: { x: dir, z: 0 },
  };
  if (car.kind === 'truck') return renderSemiTruck3D(car, time, resolvedPose);
  if (car.kind === 'motorcycle') return renderMotorcycle3D(car, time, resolvedPose);
  return renderPassengerVehicle3D(car, time, resolvedPose);
}

/** Renders a cyclist in 3D perspective along `pose` (or canonical 16 m pose if omitted). */
export function cyclistSvg(id: number, time: number, pose?: VehicleCameraPose): string {
  const resolved: VehicleCameraPose = pose ?? {
    center: { x: 0, z: 16 },
    forward: { x: 0, z: 1 },
    right: { x: 1, z: 0 },
  };
  const viewSideDot = resolved.right.x * resolved.center.x + resolved.right.z * resolved.center.z;
  const nearSide: -1 | 1 = viewSideDot > 0 ? -1 : 1;
  const pedal = Math.sin(time * 5 + id) * 0.11;
  const shadow = renderGroundShadow(resolved, 0.24, -0.88, 0.88, 0.36);
  const wRear = renderWheel3D(resolved, nearSide, nearSide * 0.03, -0.54, 0.33, 0.05, '#9aa8b0');
  const wFront = renderWheel3D(resolved, nearSide, nearSide * 0.03, 0.54, 0.33, 0.05, '#9aa8b0');

  const jersey = id % 2 ? '#dea85e' : '#5fa3ab';
  const rider =
    // Frame + seatpost
    buildLoft(
      resolved,
      [
        { z: -0.45, w: 0.035, yBot: 0.34, yTop: 0.86 },
        { z: 0.42, w: 0.035, yBot: 0.36, yTop: 0.92 },
      ],
      { top: '#8fa0a8', front: '#75868e', rear: '#75868e', sideLight: '#8fa0a8', sideDark: '#62727a' },
    ).svg +
    // Pedaling legs
    buildLoft(
      resolved,
      [
        { z: -0.22, w: 0.13, yBot: 0.38 + pedal, yTop: 0.88 },
        { z: -0.02, w: 0.13, yBot: 0.38 - pedal, yTop: 0.88 },
      ],
      { top: '#2b3945', front: '#24313c', rear: '#24313c', sideLight: '#2b3945', sideDark: '#1e2933' },
    ).svg +
    // Torso
    buildLoft(
      resolved,
      [
        { z: -0.22, w: 0.16, yBot: 0.88, yTop: 1.30 },
        { z: 0.12, w: 0.15, yBot: 0.94, yTop: 1.32 },
      ],
      { top: jersey, front: jersey, rear: jersey, sideLight: jersey, sideDark: jersey },
      '#24333d',
    ).svg +
    // Rounded cycling helmet + rear safety LED
    buildLoft(
      resolved,
      [
        { z: -0.06, w: 0.08, yBot: 1.36, yTop: 1.49 },
        { z: 0.04, w: 0.105, yBot: 1.34, yTop: 1.54 },
        { z: 0.14, w: 0.08, yBot: 1.36, yTop: 1.49 },
      ],
      { top: '#dce4e2', front: '#b8c4c2', rear: '#b8c4c2', sideLight: '#dce4e2', sideDark: '#a6b2b0' },
    ).svg +
    polyFace(
      [
        toCam(resolved, -0.05, 0.74, -0.48),
        toCam(resolved, 0.05, 0.74, -0.48),
        toCam(resolved, 0.05, 0.81, -0.48),
        toCam(resolved, -0.05, 0.81, -0.48),
      ],
      '#f04842',
    );

  return shadow + (wFront.depth > wRear.depth ? wFront.svg + rider + wRear.svg : wRear.svg + rider + wFront.svg);
}
