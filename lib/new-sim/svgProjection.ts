import { CAR_LENGTH, mod, vehicleLength, Simulation } from './simulation';
import { trafficCarSvg, cyclistSvg, type VehicleCameraPose } from './svgCar';

/** One metric camera for road paint, planned path and traffic. Positive x is screen-right. */
export const SVG_CAMERA = { width: 480, height: 270, horizon: 84, focal: 300, heightM: 1.65, near: 2.5, far: 150 };
export interface CameraPoint { x: number; z: number; height: number }

export function projectPoint(p: CameraPoint) {
  return {
    x: SVG_CAMERA.width / 2 + (SVG_CAMERA.focal * p.x) / p.z,
    y: SVG_CAMERA.horizon + (SVG_CAMERA.focal * (SVG_CAMERA.heightM - p.height)) / p.z,
  };
}

function clipPolygonNear(points: CameraPoint[]): CameraPoint[] {
  const clipped: CameraPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const insideA = a.z >= SVG_CAMERA.near, insideB = b.z >= SVG_CAMERA.near;
    if (insideA) clipped.push(a);
    if (insideA !== insideB) {
      const t = (SVG_CAMERA.near - a.z) / (b.z - a.z);
      clipped.push({
        x: a.x + (b.x - a.x) * t,
        z: SVG_CAMERA.near,
        height: a.height + (b.height - a.height) * t,
      });
    }
  }
  return clipped.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.height));
}

/** Clip in camera space before perspective division, including polygons crossing the camera. */
export function projectPolygon(points: CameraPoint[]): string {
  const clipped = clipPolygonNear(points);
  if (clipped.length < 3) return '';
  return clipped.map((p, i) => {
    const q = projectPoint(p);
    return `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`;
  }).join(' ') + ' Z';
}

/**
 * Projects a 3D planar face whose vertices are listed CCW from outside.
 * Automatically culls back-faces (e.g. hidden walls or roofs above camera eye height).
 */
function projectCulledFace(points: CameraPoint[], fill: string, stroke?: string, strokeWidth = 0.35): string {
  const clipped = clipPolygonNear(points);
  if (clipped.length < 3) return '';
  const screen = clipped.map(projectPoint);
  let area2 = 0;
  for (let i = 0; i < screen.length; i++) {
    const a = screen[i], b = screen[(i + 1) % screen.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  if (area2 >= -0.04) return '';
  const d = screen.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + 'Z';
  const st = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"` : '';
  return `<path d="${d}" fill="${fill}"${st}/>`;
}

export function createSvgCamera(sim: Simulation) {
  const origin = sim.road.point(sim.ego.s, sim.laneOffset(sim.ego));
  const tangent = sim.road.tangent(sim.ego.s);
  const angle = Math.atan2(tangent.x, tangent.z) + sim.ego.headingError;
  const fx = Math.sin(angle), fz = Math.cos(angle);
  return (s: number, offset: number, height = 0): CameraPoint => {
    const world = sim.road.point(s, offset);
    const dx = world.x - origin.x, dz = world.z - origin.z;
    return { x: -dx * fz + dz * fx, z: dx * fx + dz * fz, height };
  };
}

export interface SvgFrame {
  road: string;
  shoulder: string;
  barrier: string;
  markings: string;
  intersections: string;
  laneLines: string;
  path: string;
  pathEdge: string;
  pathFade: string;
  leadArrow: string;
  traffic: string;
  furniture: string;
  scenery: string;
  horizonShift: number;
}

/** Static roadside landmarks anchored to route distance, never to animation time. */
function collectScenery(sim: Simulation, camera: ReturnType<typeof createSvgCamera>): { depth: number; svg: string }[] {
  const city = sim.options.scenario === 'city';
  const curves = sim.options.scenario === 'curves';
  const highway = sim.options.scenario === 'highway';
  if (!city && !curves && !highway) return [];

  const spacing = city ? 24 : highway ? 48 : 13;
  const count = Math.max(1, Math.ceil(sim.road.length / spacing));
  const interval = sim.road.length / count;
  const objects: { depth: number; svg: string }[] = [];

  for (let i = Math.floor(sim.ego.s / interval) - 1; i * interval < sim.ego.s + 165; i++) {
    const index = ((i % count) + count) % count;
    const sides = highway ? [-1] : [-1, 1];
    for (const side of sides) {
      const seed = (index * 17 + (side + 1) * 7) % 31;
      const s = i * interval + (side === 1 ? interval * 0.35 : 0);
      if (sim.road.junctions.some(j => Math.min(sim.road.distance(s, j.s), sim.road.distance(j.s, s)) < (city ? 24 : 12))) continue;
      const offset = side * (sim.road.lanes.verge + (city ? 3.2 : highway ? 3.5 + (seed % 3) * 1.4 : 1.8 + (seed % 4)));
      const point = camera(s, offset);
      if (point.z < 2.8 || point.z > 158) continue;
      const opacity = Math.min(1, (166 - point.z) / 42);
      let svg = '';
      let objDepth = Math.hypot(point.x, point.z);

      if (city) {
        const height = 6.2 + (seed % 4) * 2.4;
        const halfLen = (6.4 + (seed % 3) * 1.1) / 2;
        const nearX = offset - side * 2.8;
        const farX = offset + side * 2.8;
        const xMin = Math.min(nearX, farX);
        const xMax = Math.max(nearX, farX);
        const z0 = s - halfLen;
        const z1 = s + halfLen;

        const cNearA = camera(z0, nearX, 0);
        const cNearB = camera(z1, nearX, 0);
        const cNearMid = camera(s, nearX, 0);
        objDepth = Math.min(
          Math.hypot(cNearA.x, cNearA.z),
          Math.hypot(cNearB.x, cNearB.z),
          Math.hypot(cNearMid.x, cNearMid.z),
        );

        const wallFront = ['#7c7873', '#687987', '#948374', '#607673'][seed % 4];
        const wallSide = ['#555c65', '#4c5b68', '#6b625b', '#475959'][seed % 4];

        // 4 vertical walls + roof with outward CCW winding so back-faces & overhead roofs cull cleanly!
        // Approach wall (z = z0, outward -s)
        svg += projectCulledFace(
          [camera(z0, xMax, 0), camera(z0, xMin, 0), camera(z0, xMin, height), camera(z0, xMax, height)],
          wallSide, '#35414b',
        );
        // Far wall (z = z1, outward +s)
        svg += projectCulledFace(
          [camera(z1, xMin, 0), camera(z1, xMax, 0), camera(z1, xMax, height), camera(z1, xMin, height)],
          wallSide, '#35414b',
        );
        // Right-facing wall (offset = xMin, outward -offset / +screen-x)
        const rightWall = projectCulledFace(
          [camera(z0, xMin, 0), camera(z1, xMin, 0), camera(z1, xMin, height), camera(z0, xMin, height)],
          side === 1 ? wallFront : wallSide, '#35414b',
        );
        // Left-facing wall (offset = xMax, outward +offset / -screen-x)
        const leftWall = projectCulledFace(
          [camera(z1, xMax, 0), camera(z0, xMax, 0), camera(z0, xMax, height), camera(z1, xMax, height)],
          side === -1 ? wallFront : wallSide, '#35414b',
        );
        svg += rightWall + leftWall;

        // Parapet / roof cornice trim
        const faceOffset = nearX;
        const windowFace = (za: number, zb: number, ya: number, yb: number, fill: string) =>
          side === 1
            ? projectCulledFace([camera(za, faceOffset, ya), camera(zb, faceOffset, ya), camera(zb, faceOffset, yb), camera(za, faceOffset, yb)], fill)
            : projectCulledFace([camera(zb, faceOffset, ya), camera(za, faceOffset, ya), camera(za, faceOffset, yb), camera(zb, faceOffset, yb)], fill);

        svg += windowFace(z0, z1, height - 0.25, height, '#aeb6b9');
        for (let h = 2.3; h < height - 1.1; h += 2.15) {
          for (let wz = z0 + 0.75; wz < z1 - 0.75; wz += 1.45) {
            const lit = (seed + Math.floor(wz * 1.3 + h)) % 5 === 0;
            svg += windowFace(wz, wz + 0.82, h, h + 1.12, lit ? '#dfd3a4' : '#233643');
          }
        }
        // Ground-floor shopfront glazing
        svg += windowFace(s - 0.9, s + 0.9, 0, 1.85, '#1e323e');
      } else {
        const q = projectPoint(point);
        const scale = SVG_CAMERA.focal / point.z;
        const height = 5.4 + (seed % 5) * 0.95;
        const crown = !highway && seed % 3 !== 0
          ? `<path d="M0,-${height.toFixed(2)} L-1.35,-${(height - 2.4).toFixed(2)} H-0.72 L-1.85,-${(height - 4.1).toFixed(2)} H-1.05 L-2.15,-1.35 H2.15 L1.05,-${(height - 4.1).toFixed(2)} H1.85 L0.72,-${(height - 2.4).toFixed(2)} H1.35Z" fill="#23523e"/>` +
            `<path d="M0,-${height.toFixed(2)} V-1.35 H2.15 L1.05,-${(height - 4.1).toFixed(2)} H1.85 L0.72,-${(height - 2.4).toFixed(2)} H1.35Z" fill="#326b50"/>`
          : `<ellipse cy="-${(height - 2.0).toFixed(2)}" rx="2.05" ry="2.35" fill="#2d5f44"/>` +
            `<ellipse cx="-0.75" cy="-${(height - 1.75).toFixed(2)}" rx="1.45" ry="1.75" fill="#3d7351"/>` +
            `<ellipse cx="0.65" cy="-${(height - 1.05).toFixed(2)}" rx="1.25" ry="1.35" fill="#4d825b"/>`;
        svg = `<g transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})"><ellipse rx="1.9" ry="0.26" fill="#071715" opacity="0.45"/><path d="M-0.18,0 L-0.12,-${(height - 1.1).toFixed(2)} H0.12 L0.20,0Z" fill="#6b5846"/>${crown}</g>`;
      }

      if (svg) {
        objects.push({
          depth: objDepth,
          svg: `<g data-scenery="${city ? 'building' : 'tree'}" opacity="${opacity.toFixed(2)}">${svg}</g>`,
        });
      }
    }

    // Curves delineator reflector posts right along the gravel verge for strong speed/bend perception
    if (curves && index % 2 === 0) {
      for (const side of [-1, 1]) {
        const postS = i * interval + interval * 0.5;
        if (sim.road.junctions.some(j => Math.min(sim.road.distance(postS, j.s), sim.road.distance(j.s, postS)) < 12)) continue;
        const p = camera(postS, side * (sim.road.lanes.verge - 0.45));
        if (p.z < SVG_CAMERA.near + 0.5 || p.z > 110) continue;
        const q = projectPoint(p), scale = SVG_CAMERA.focal / p.z;
        const refl = side === -1 ? '#ef5350' : '#f6c84c';
        objects.push({
          depth: Math.hypot(p.x, p.z),
          svg: `<g data-scenery="post" transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})"><rect x="-0.045" y="-0.95" width="0.09" height="0.95" fill="#dce3e6"/><rect x="-0.04" y="-0.86" width="0.08" height="0.14" fill="${refl}"/></g>`,
        });
      }
    }
  }
  return objects;
}

/** 3D concrete Jersey median barrier on highway layouts. */
function renderHighwayBarrier(sim: Simulation, camera: ReturnType<typeof createSvgCamera>): string {
  const barrierOffset = sim.road.lanes.barrier;
  if (barrierOffset === null) return '';
  const start = sim.ego.s;
  const steps = 36;
  const span = 148;
  const innerBot: CameraPoint[] = [];
  const innerTop: CameraPoint[] = [];
  const outerTop: CameraPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = start + (span * i) / steps;
    innerBot.push(camera(s, barrierOffset - 0.30, 0));
    innerTop.push(camera(s, barrierOffset - 0.16, 0.88));
    outerTop.push(camera(s, barrierOffset + 0.16, 0.88));
  }
  const wallD = projectPolygon([...innerBot, ...[...innerTop].reverse()]);
  const capD = projectPolygon([...innerTop, ...[...outerTop].reverse()]);
  return (wallD ? `<path d="${wallD}" fill="#5e6b75"/>` : '') + (capD ? `<path d="${capD}" fill="#8a97a1"/>` : '');
}

/** Builds a vehicle's exact orthonormal 3D camera-space pose along the road spline. */
function roadVehiclePose(
  camera: ReturnType<typeof createSvgCamera>,
  s: number,
  offset: number,
  direction: number,
  extraYaw = 0,
): VehicleCameraPose {
  const c0 = camera(s, offset, 0);
  const c1 = camera(s + 0.5 * direction, offset, 0);
  let fx = c1.x - c0.x;
  let fz = c1.z - c0.z;
  const len = Math.hypot(fx, fz) || 1;
  fx /= len;
  fz /= len;
  if (extraYaw !== 0) {
    const cos = Math.cos(extraYaw), sin = Math.sin(extraYaw);
    const rx = fx * cos + fz * sin;
    const rz = -fx * sin + fz * cos;
    fx = rx;
    fz = rz;
  }
  return {
    center: { x: c0.x, z: c0.z },
    forward: { x: fx, z: fz },
    right: { x: fz, z: -fx },
  };
}

/** Stateless SVG adapter: all movement, signal state and model behavior belong to Simulation. */
export function renderSvgFrame(sim: Simulation): SvgFrame {
  const camera = createSvgCamera(sim), start = sim.ego.s;
  const egoTangent = sim.road.tangent(start);
  const headingAngle = Math.atan2(egoTangent.x, egoTangent.z) + sim.ego.headingError;
  const horizonShift = mod((headingAngle / (Math.PI * 2)) * 960, 480);

  const { lanes } = sim.road;
  const strip = (from: number, to: number, left: number, right: number, offset?: (d: number) => number) => {
    const a: CameraPoint[] = [], b: CameraPoint[] = [];
    const steps = Math.max(1, Math.ceil((to - from) / 2.5));
    for (let i = 0; i <= steps; i++) {
      const d = from + ((to - from) * i) / steps, centre = offset?.(d) ?? 0;
      a.push(camera(start + d, centre + left));
      b.push(camera(start + d, centre + right));
    }
    return projectPolygon([...a, ...b.reverse()]);
  };
  const pathElement = (d: string, fill: string, opacity = 1) =>
    d ? `<path d="${d}" fill="${fill}"${opacity < 0.999 ? ` opacity="${opacity.toFixed(2)}"` : ''}/>` : '';

  // Cross streets use the junction's tangent, so their axes stay perpendicular
  // even when the approach road bends. Keep the full crossing visible while passing it.
  const crossings = sim.road.junctions.map(j => {
    let distance = sim.road.distance(start, j.s);
    if (distance > sim.road.length / 2) distance -= sim.road.length;
    return { junction: j, distance };
  }).filter(j => j.distance > -15 && j.distance < 160);

  const crossHalfWidth = 3.6;
  let intersections = '';
  for (const { junction } of crossings) {
    const origin = camera(junction.s, 0), normalPoint = camera(junction.s, 1);
    const nx = normalPoint.x - origin.x, nz = normalPoint.z - origin.z;
    const crossPoint = (along: number, across: number): CameraPoint => ({
      x: origin.x + nx * across + nz * along,
      z: origin.z + nz * across - nx * along,
      height: 0,
    });
    const rectangle = (a: number, b: number, left: number, right: number, fill: string, op = 1) =>
      pathElement(projectPolygon([crossPoint(a, left), crossPoint(a, right), crossPoint(b, right), crossPoint(b, left)]), fill, op);
    let street = rectangle(-crossHalfWidth, crossHalfWidth, -100, 100, '#25303d');
    for (const side of [-1, 1]) {
      const bounds = [side * lanes.surface, side * 100].sort((a, b) => a - b);
      for (const edge of [-crossHalfWidth, crossHalfWidth]) {
        street += rectangle(edge - 0.5, edge + 0.5, bounds[0], bounds[1], '#344348');
        street += rectangle(edge - 0.055, edge + 0.055, bounds[0], bounds[1], '#d5dee5', 0.85);
      }
      for (const line of [-0.12, 0.12]) {
        street += rectangle(line - 0.045, line + 0.045, bounds[0], bounds[1], '#e6c779');
      }
      // Crosswalk zebra stripes on signalized city/boulevard crossings
      if (junction.kind === 'signal' && sim.options.scenario !== 'curves') {
        const cwAlong = side * (crossHalfWidth + 1.55);
        for (let x = -lanes.surface + 0.6; x <= lanes.surface - 0.6; x += 1.15) {
          street += rectangle(cwAlong - 0.95, cwAlong + 0.95, x - 0.26, x + 0.26, '#e2e8f0', 0.68);
        }
      }
    }
    intersections += `<g data-intersection="${junction.id}">${street}</g>`;
  }

  // Physical lane paint ends at the crossing, leaving an open paved junction.
  const paintStrip = (from: number, to: number, left: number, right: number) => {
    let segments = [[from, to]];
    for (const { distance } of crossings) {
      const near = distance - crossHalfWidth, far = distance + crossHalfWidth;
      segments = segments.flatMap(([a, b]) =>
        b <= near || a >= far ? [[a, b]] : [...(a < near ? [[a, near]] : []), ...(b > far ? [[far, b]] : [])],
      );
    }
    return segments.map(([a, b]) => strip(a, b, left, right)).join(' ');
  };

  let markings = '';
  for (const edge of [-lanes.edgeLine, lanes.edgeLine]) {
    if (lanes.edgeLine) markings += pathElement(paintStrip(0, 150, edge - 0.06, edge + 0.06), '#d8e2ea', 0.82);
  }
  if (lanes.centerLine) {
    for (const edge of [-0.13, 0.13]) markings += pathElement(paintStrip(0, 150, edge - 0.045, edge + 0.045), '#eab95c', 0.92);
  }
  for (const divider of lanes.dividers) {
    // Paint is anchored to the road, so its optical flow follows actual distance travelled.
    for (let s = Math.floor(start / 12) * 12; s < start + 150; s += 12) {
      markings += pathElement(paintStrip(s - start, s - start + 3.2, divider - 0.06, divider + 0.06), '#d8e2ea', 0.74);
    }
  }
  if (lanes.median) {
    markings += pathElement(paintStrip(0, 150, -lanes.median, lanes.median), '#213a35');
    for (const curb of [-lanes.median, lanes.median]) {
      markings += pathElement(paintStrip(0, 150, curb - 0.1, curb + 0.1), '#6e7e85', 0.75);
    }
  }

  const lead = sim.lead(sim.ego), next = sim.nextJunction(sim.ego);
  // Track actual lateral position: a lane-change destination alone is not a lead.
  const laneHalf = sim.options.scenario === 'curves' ? 1.55 : 1.8;
  const visibleLead = sim.cars
    .filter(
      car =>
        car.id !== sim.ego.id &&
        car.direction === sim.ego.direction &&
        Math.abs(sim.laneOffset(car) - lanes.offsets[sim.ego.lane]) < laneHalf,
    )
    .map(car => ({ car, distance: sim.road.distance(start, car.s) - vehicleLength(car) / 2 }))
    .filter(item => item.distance > SVG_CAMERA.near && item.distance < 145)
    .sort((a, b) => a.distance - b.distance)[0];

  let pathDistance = visibleLead?.distance ?? Math.min(90, Math.max(3, lead.gap + CAR_LENGTH / 2));
  if (next && ((next.kind === 'stop' && sim.ego.released !== next.id) || (next.kind === 'signal' && sim.signal(next.id) !== 'green'))) {
    pathDistance = Math.min(pathDistance, Math.max(3, next.distance - 1));
  }

  const halfLane = sim.options.scenario === 'curves' ? 1.55 : 1.8;
  const laneCentre = lanes.offsets[sim.ego.lane];
  const laneLines = [-halfLane, halfLane]
    .map(edge => pathElement(strip(0, 95, laneCentre + edge - 0.048, laneCentre + edge + 0.048), '#ffffff', 0.95))
    .join('');

  const fadeLength = visibleLead && Math.abs(pathDistance - visibleLead.distance) < 0.01 ? Math.min(2.4, pathDistance * 0.16) : 0;
  const solidPathEnd = Math.max(0.5, pathDistance - fadeLength);
  const path = strip(0, solidPathEnd, -0.74, 0.74, d => sim.plannedLaneOffset(d));
  const pathEdge = [-0.74, 0.74]
    .map(edge => strip(0, solidPathEnd, edge - 0.045, edge + 0.045, d => sim.plannedLaneOffset(d)))
    .filter(Boolean)
    .join(' ');

  const pathColor = sim.model.pathColor || '#2ddc73';
  let pathFade = '';
  for (let i = 0; i < 12 && fadeLength; i++) {
    const a = solidPathEnd + (fadeLength * i) / 12;
    const b = solidPathEnd + (fadeLength * (i + 1)) / 12;
    pathFade += pathElement(strip(a, b, -0.74, 0.74, d => sim.plannedLaneOffset(d)), pathColor, 0.32 * (1 - (i + 0.5) / 12));
  }

  let leadArrow = '';
  if (visibleLead) {
    const p = camera(visibleLead.car.s - vehicleLength(visibleLead.car) / 2, sim.laneOffset(visibleLead.car), 0.12);
    if (p.z >= SVG_CAMERA.near && p.z < 145) {
      const q = projectPoint(p), size = Math.max(5.5, Math.min(13.5, 185 / p.z));
      leadArrow = `<path data-lead="${visibleLead.car.id}" d="M${q.x.toFixed(2)},${(q.y - 2).toFixed(2)} l${(-size).toFixed(2)},${(size * 0.72).toFixed(2)} h${(size * 2).toFixed(2)}Z" fill="#facc15" stroke="#fef08a" stroke-width="1.1" stroke-linejoin="round"/>`;
    }
  }

  const objects: { depth: number; svg: string }[] = [];
  for (const car of sim.cars) {
    if (car.id === 0) continue;
    const halfL = vehicleLength(car) / 2;
    const offset = sim.laneOffset(car);

    // Compute realistic steering yaw during lane changes from derivative of quintic smoothstep
    let mergeYaw = 0;
    if (car.laneChange && car.speed > 1) {
      const t = Math.min(1, car.laneChange.elapsed / car.laneChange.duration);
      const dEaseDt = (30 * t * t * (1 - t) * (1 - t)) / car.laneChange.duration;
      // Positive lateral offset moves left (-x in car frame); positive yaw rotates nose right (+x)
      const vLatLeft = -car.laneChange.offset * dEaseDt;
      mergeYaw = Math.max(-0.22, Math.min(0.22, Math.atan2(-vLatLeft * car.direction, Math.max(3, car.speed))));
    }

    const pose = roadVehiclePose(camera, car.s, offset, car.direction, mergeYaw);
    const frontZ = pose.center.z + pose.forward.z * halfL;
    const rearZ = pose.center.z - pose.forward.z * halfL;
    if (Math.max(frontZ, rearZ) < SVG_CAMERA.near + 0.15 || Math.min(frontZ, rearZ) > 148) continue;

    // Sort by closest 3D surface point to camera so long trucks & adjacent cars never invert occlusion
    const clampedAlong = Math.max(-halfL, Math.min(halfL, -(pose.center.x * pose.forward.x + pose.center.z * pose.forward.z)));
    const closestX = pose.center.x + pose.forward.x * clampedAlong;
    const closestZ = pose.center.z + pose.forward.z * clampedAlong;
    const depth = Math.hypot(closestX, closestZ);
    const fadeOp = closestZ > 118 ? Math.max(0.2, (152 - closestZ) / 34) : 1;
    const opAttr = fadeOp < 0.99 ? ` opacity="${fadeOp.toFixed(2)}"` : '';
    const inner = trafficCarSvg(car, sim.time, pose);
    if (inner) {
      objects.push({
        depth,
        svg: `<g data-vehicle="${car.id}" data-kind="${car.kind}"${opAttr}>${inner}</g>`,
      });
    }
  }

  for (const cyclist of sim.cyclists) {
    const offset = -lanes.surface + 0.52;
    const pose = roadVehiclePose(camera, cyclist.s, offset, 1);
    if (pose.center.z < SVG_CAMERA.near || pose.center.z > 140) continue;
    const inner = cyclistSvg(cyclist.id, sim.time, pose);
    if (inner) {
      objects.push({
        depth: Math.hypot(pose.center.x, pose.center.z),
        svg: `<g data-cyclist="${cyclist.id}">${inner}</g>`,
      });
    }
  }

  // Cross traffic uses full 3D perspective vehicles aligned with the perpendicular cross street.
  for (const car of sim.crossCars) {
    const junction = sim.road.junctions.find(j => j.id === car.junction);
    if (!junction) continue;
    const center = camera(junction.s + car.direction * 1.8, car.x * car.direction, 0);
    if (center.z < SVG_CAMERA.near || center.z > 145) continue;
    // Cross car advances with increasing `car.x`, so its world offset changes at rate `+car.direction`
    const ahead = camera(junction.s + car.direction * 1.8, (car.x + 1) * car.direction, 0);
    let fx = ahead.x - center.x;
    let fz = ahead.z - center.z;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len;
    fz /= len;
    const pose: VehicleCameraPose = {
      center: { x: center.x, z: center.z },
      forward: { x: fx, z: fz },
      right: { x: fz, z: -fx },
    };
    const allowed = sim.crossCanProceed(car.junction);
    const boundary = allowed || car.x > -13 ? 65 : -14;
    const isBraking = car.x >= boundary - 0.5 || car.x < -68;
    const inner = trafficCarSvg(
      {
        id: car.id + 50,
        kind: car.id % 3 === 0 ? 'suv' : 'sedan',
        direction: 1,
        braking: isBraking,
        lateral: 0,
      },
      sim.time,
      pose,
    );
    if (inner) {
      objects.push({
        depth: Math.hypot(center.x, center.z),
        svg: `<g data-cross-vehicle="${car.id}">${inner}</g>`,
      });
    }
  }

  const furnitureItems: { depth: number; svg: string }[] = [];
  for (const junction of sim.road.junctions) {
    const distance = sim.road.distance(start, junction.s - 12);
    if (distance > 150) continue;
    const base = lanes.offsets[sim.ego.lane];
    markings += pathElement(strip(distance - 0.22, distance + 0.22, base - 1.72, base + 1.72), '#f1f5f9', 0.92);
    const p = camera(junction.s - 12, -lanes.surface - 0.65);
    if (p.z < SVG_CAMERA.near || p.z > 150) continue;
    const q = projectPoint(p), scale = SVG_CAMERA.focal / p.z;
    const signal = sim.signal(junction.id);
    const sign =
      junction.kind === 'stop'
        ? `<ellipse rx="0.22" ry="0.05" fill="#071018" opacity="0.45"/>` +
          `<path d="M0,0 V-2.6" stroke="#7d8f9e" stroke-width="0.085"/>` +
          `<path d="M-0.25,-3.62 L0.25,-3.62 L0.61,-3.26 L0.61,-2.74 L0.25,-2.38 L-0.25,-2.38 L-0.61,-2.74 L-0.61,-3.26 Z" fill="#dc2632" stroke="#f8fafc" stroke-width="0.065"/>` +
          `<text y="-2.88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="0.33" font-weight="800" fill="#ffffff">STOP</text>`
        : `<ellipse rx="0.26" ry="0.06" fill="#071018" opacity="0.45"/>` +
          `<path d="M0,0 V-4.85 H-2.25" fill="none" stroke="#6c7f8e" stroke-width="0.11" stroke-linejoin="round"/>` +
          `<rect x="-2.48" y="-5.22" width="0.54" height="1.48" rx="0.11" fill="#0c1824" stroke="#7f91a1" stroke-width="0.04"/>` +
          (['red', 'amber', 'green'] as const)
            .map((phase, i) => {
              const cy = -4.93 + i * 0.44;
              const active = signal === phase;
              const col = { red: '#ff5964', amber: '#fbbf24', green: '#34d399' }[phase];
              return (
                (active ? `<circle cx="-2.21" cy="${cy}" r="0.28" fill="${col}" opacity="0.28"/>` : '') +
                `<circle cx="-2.21" cy="${cy}" r="0.155" fill="${active ? col : '#202c38'}"/>`
              );
            })
            .join('');
    furnitureItems.push({
      depth: Math.hypot(p.x, p.z),
      svg: `<g transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})">${sign}</g>`,
    });
  }

  const worldSorted = [...collectScenery(sim, camera), ...furnitureItems, ...objects]
    .sort((a, b) => b.depth - a.depth)
    .map(o => o.svg)
    .join('');

  return {
    road: strip(0, 150, -lanes.surface, lanes.surface),
    shoulder: strip(0, 150, -lanes.verge, lanes.verge),
    barrier: renderHighwayBarrier(sim, camera),
    markings,
    intersections,
    laneLines,
    path,
    pathEdge,
    pathFade,
    leadArrow,
    traffic: worldSorted,
    furniture: '',
    scenery: '',
    horizonShift,
  };
}
