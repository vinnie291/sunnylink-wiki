import { CAR_LENGTH, vehicleLength, Simulation } from './simulation';
import { trafficCarSvg, cyclistSvg } from './svgCar';

/** One metric camera for road paint, planned path and traffic. Positive x is screen-right. */
export const SVG_CAMERA = { width: 480, height: 270, horizon: 84, focal: 300, heightM: 1.65, near: 2.5, far: 150 };
export interface CameraPoint { x: number; z: number; height: number }
export function projectPoint(p: CameraPoint) {
  return { x: SVG_CAMERA.width / 2 + SVG_CAMERA.focal * p.x / p.z,
    y: SVG_CAMERA.horizon + SVG_CAMERA.focal * (SVG_CAMERA.heightM - p.height) / p.z };
}

/** Clip in camera space before perspective division, including polygons crossing the camera. */
export function projectPolygon(points: CameraPoint[]): string {
  let clipped: CameraPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const insideA = a.z >= SVG_CAMERA.near, insideB = b.z >= SVG_CAMERA.near;
    if (insideA) clipped.push(a);
    if (insideA !== insideB) {
      const t = (SVG_CAMERA.near - a.z) / (b.z - a.z);
      clipped.push({ x: a.x + (b.x - a.x) * t, z: SVG_CAMERA.near, height: a.height + (b.height - a.height) * t });
    }
  }
  if (clipped.length < 3) return '';
  clipped = clipped.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z));
  return clipped.map((p, i) => { const q = projectPoint(p); return `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`; }).join(' ') + ' Z';
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

export interface SvgFrame { road: string; shoulder: string; markings: string; intersections: string; laneLines: string; path: string; pathFade: string; leadArrow: string; traffic: string; furniture: string; scenery: string }

/** Static roadside landmarks anchored to route distance, never to animation time. */
function renderScenery(sim: Simulation, camera: ReturnType<typeof createSvgCamera>): string {
  const city = sim.options.scenario === 'city';
  if (!city && sim.options.scenario !== 'curves') return '';
  const spacing = city ? 24 : 13;
  const count = Math.ceil(sim.road.length / spacing);
  const interval = sim.road.length / count;
  const objects: { depth: number; svg: string }[] = [];
  for (let i = Math.floor(sim.ego.s / interval) - 1; i * interval < sim.ego.s + 170; i++) {
    const index = ((i % count) + count) % count;
    for (const side of [-1, 1]) {
      const seed = (index * 17 + (side + 1) * 7) % 31;
      const s = i * interval + (side === 1 ? interval * .35 : 0);
      if (sim.road.junctions.some(j => Math.min(sim.road.distance(s, j.s), sim.road.distance(j.s, s)) < (city ? 24 : 12))) continue;
      const offset = side * (sim.road.lanes.verge + (city ? 3 : 1.8 + seed % 4));
      const point = camera(s, offset);
      if (point.z < 3 || point.z > 160) continue;
      const opacity = Math.min(1, (170 - point.z) / 45);
      let svg = '';
      if (city) {
        const height = 5.5 + seed % 4 * 2.3;
        const width = 5.5 + seed % 3;
        const front = offset - side * 2.5, back = offset + side * 2.5;
        const a = s - width / 2, b = s + width / 2;
        const face = (vertices: [number, number, number][], fill: string) => `<path d="${projectPolygon(vertices.map(([z, x, h]) => camera(z, x, h)))}" fill="${fill}"/>`;
        const color = ['#8b827a', '#70808c', '#a59180', '#687e79'][seed % 4];
        svg += face([[a, front, 0], [a, back, 0], [a, back, height], [a, front, height]], '#46555f');
        svg += face([[a, front, 0], [b, front, 0], [b, front, height], [a, front, height]], color);
        svg += face([[a, front, height], [b, front, height], [b, back, height], [a, back, height]], '#a5aba7');
        for (let h = 2.1; h < height - 1; h += 2.1) {
          for (let z = a + .8; z < b - .6; z += 1.5) {
            svg += face([[z, front, h], [z + .8, front, h], [z + .8, front, h + 1.1], [z, front, h + 1.1]], (seed + Math.floor(z)) % 4 === 0 ? '#d5cda3' : '#2b414e');
          }
        }
        svg += face([[s - .6, front, 0], [s + .6, front, 0], [s + .6, front, 1.8], [s - .6, front, 1.8]], '#253b46');
      } else {
        const q = projectPoint(point), scale = SVG_CAMERA.focal / point.z;
        const height = 5 + seed % 5;
        const crown = seed % 2 === 0
          ? `<path d="M0,-${height} L-1.4,-${height - 2.7} H-.7 L-2,-1.5 H2 L.7,-${height - 2.7} H1.4Z" fill="#285b45"/><path d="M0,-${height} V-1.5 H2 L.7,-${height - 2.7} H1.4Z" fill="#367253"/>`
          : `<ellipse cy="-${height - 2}" rx="2.1" ry="2.4" fill="#35694b"/><ellipse cx="-.8" cy="-${height - 1.7}" rx="1.5" ry="1.8" fill="#477d53"/><ellipse cx=".6" cy="-${height - .9}" rx="1.3" ry="1.4" fill="#56895d"/>`;
        svg = `<g transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})"><ellipse rx="2" ry=".3" fill="#0b201c" opacity=".5"/><path d="M-.17,0 L-.12,-${height - 1} H.12 L.22,0Z" fill="#7a6550"/>${crown}</g>`;
      }
      objects.push({ depth: point.z, svg: `<g data-scenery="${city ? 'building' : 'tree'}" opacity="${opacity.toFixed(2)}">${svg}</g>` });
    }
  }
  return objects.sort((a, b) => b.depth - a.depth).map(o => o.svg).join('');
}

/** Stateless SVG adapter: all movement, signal state and model behavior belong to Simulation. */
export function renderSvgFrame(sim: Simulation): SvgFrame {
  const camera = createSvgCamera(sim), start = sim.ego.s;
  const { lanes } = sim.road;
  const strip = (from: number, to: number, left: number, right: number, offset?: (d: number) => number) => {
    const a: CameraPoint[] = [], b: CameraPoint[] = [];
    const steps = Math.max(1, Math.ceil((to - from) / 3));
    for (let i = 0; i <= steps; i++) {
      const d = from + (to - from) * i / steps, centre = offset?.(d) ?? 0;
      a.push(camera(start + d, centre + left)); b.push(camera(start + d, centre + right));
    }
    return projectPolygon([...a, ...b.reverse()]);
  };
  const pathElement = (d: string, fill: string, opacity = 1) => d ? `<path d="${d}" fill="${fill}" opacity="${opacity}"/>` : '';
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
      z: origin.z + nz * across - nx * along, height: 0,
    });
    const rectangle = (a: number, b: number, left: number, right: number, fill: string) =>
      pathElement(projectPolygon([crossPoint(a, left), crossPoint(a, right), crossPoint(b, right), crossPoint(b, left)]), fill);
    let street = rectangle(-crossHalfWidth, crossHalfWidth, -100, 100, '#27323f');
    for (const side of [-1, 1]) {
      const bounds = [side * lanes.surface, side * 100].sort((a, b) => a - b);
      for (const edge of [-crossHalfWidth, crossHalfWidth]) {
        street += rectangle(edge - .5, edge + .5, bounds[0], bounds[1], '#354447');
        street += rectangle(edge - .055, edge + .055, bounds[0], bounds[1], '#d5dee5');
      }
      for (const line of [-.12, .12]) {
        street += rectangle(line - .045, line + .045, bounds[0], bounds[1], '#e6c779');
      }
    }
    intersections += `<g data-intersection="${junction.id}">${street}</g>`;
  }
  // Physical lane paint ends at the crossing, leaving an open paved junction.
  const paintStrip = (from: number, to: number, left: number, right: number) => {
    let segments = [[from, to]];
    for (const { distance } of crossings) {
      const near = distance - crossHalfWidth, far = distance + crossHalfWidth;
      segments = segments.flatMap(([a, b]) => b <= near || a >= far ? [[a, b]] :
        [...(a < near ? [[a, near]] : []), ...(b > far ? [[far, b]] : [])]);
    }
    return segments.map(([a, b]) => strip(a, b, left, right)).join(' ');
  };
  let markings = '';
  for (const edge of [-lanes.edgeLine, lanes.edgeLine]) {
    if (lanes.edgeLine) markings += pathElement(paintStrip(0, 150, edge - 0.055, edge + 0.055), '#d5dee5', 0.8);
  }
  if (lanes.centerLine) {
    for (const edge of [-0.12, 0.12]) markings += pathElement(paintStrip(0, 150, edge - 0.045, edge + 0.045), '#e6c779');
  }
  for (const divider of lanes.dividers) {
    // Paint is anchored to the road, so its optical flow follows actual distance travelled.
    for (let s = Math.floor(start / 12) * 12; s < start + 150; s += 12) {
      markings += pathElement(paintStrip(s - start, s - start + 3, divider - 0.06, divider + 0.06), '#d5dee5', 0.7);
    }
  }
  if (lanes.median) markings += pathElement(paintStrip(0, 150, -lanes.median, lanes.median), '#243e39');
  const lead = sim.lead(sim.ego), next = sim.nextJunction(sim.ego);
  // Track actual lateral position: a lane-change destination alone is not a lead.
  const laneHalf = sim.options.scenario === 'curves' ? 1.55 : 1.8;
  const visibleLead = sim.cars.filter(car => car.id !== sim.ego.id && car.direction === sim.ego.direction
    && Math.abs(sim.laneOffset(car) - lanes.offsets[sim.ego.lane]) < laneHalf)
    .map(car => ({ car, distance: sim.road.distance(start, car.s) - vehicleLength(car) / 2 }))
    .filter(item => item.distance > SVG_CAMERA.near && item.distance < 145)
    .sort((a, b) => a.distance - b.distance)[0];
  let pathDistance = visibleLead?.distance ?? Math.min(90, Math.max(3, lead.gap + CAR_LENGTH / 2));
  if (next && ((next.kind === 'stop' && sim.ego.released !== next.id) || (next.kind === 'signal' && sim.signal(next.id) !== 'green'))) {
    pathDistance = Math.min(pathDistance, Math.max(3, next.distance - 1));
  }
  const halfLane = sim.options.scenario === 'curves' ? 1.55 : 1.8;
  const laneCentre = lanes.offsets[sim.ego.lane];
  const laneLines = [-halfLane, halfLane].map(edge =>
    pathElement(strip(0, 95, laneCentre + edge - .045, laneCentre + edge + .045), '#ffffff', .95)).join('');
  const fadeLength = visibleLead && Math.abs(pathDistance - visibleLead.distance) < .01 ? Math.min(2, pathDistance * .15) : 0;
  const path = strip(0, pathDistance - fadeLength, -0.75, 0.75, d => sim.plannedLaneOffset(d));
  let pathFade = '';
  for (let i = 0; fadeLength && i < 12; i++) {
    pathFade += pathElement(strip(pathDistance - fadeLength + fadeLength * i / 12,
      pathDistance - fadeLength + fadeLength * (i + 1) / 12, -.75, .75, d => sim.plannedLaneOffset(d)), '#2ddc73', .28 * (1 - (i + .5) / 12));
  }
  let leadArrow = '';
  if (visibleLead) {
    const p = camera(visibleLead.car.s - vehicleLength(visibleLead.car) / 2, sim.laneOffset(visibleLead.car));
    if (p.z >= SVG_CAMERA.near && p.z < 145) {
      const q = projectPoint(p), size = Math.max(5, Math.min(13, 180 / p.z));
      leadArrow = `<path data-lead="${visibleLead.car.id}" d="M${q.x},${q.y - 2} l${-size},${size * .72} h${size * 2}Z" fill="#f6cf32" stroke="#fff09a" stroke-width="1" stroke-linejoin="round"/>`;
    }
  }

  const objects: { z: number; svg: string }[] = [];
  for (const car of sim.cars) {
    if (car.id === 0) continue;
    const p = camera(car.s - car.direction * vehicleLength(car) / 2, sim.laneOffset(car));
    if (p.z < SVG_CAMERA.near || p.z > 145) continue;
    const q = projectPoint(p), scale = SVG_CAMERA.focal / p.z;
    let body = '';
    if (car.kind === 'truck') {
      const offset = sim.laneOffset(car);
      const vertex = (along: number, across: number, height: number) => camera(car.s + along * car.direction, offset + across, height);
      const face = (corners: [number, number, number][], color: string) => `<path d="${projectPolygon(corners.map(([a, b, h]) => vertex(a, b, h)))}" fill="${color}" stroke="#667578" stroke-width=".4"/>`;
      // Trailer and tractor are separate volumes, with five axle positions (18 tyres).
      for (const side of [-1.27, 1.27]) {
        body += face([[-8.5, side, .8], [4.7, side, .8], [4.7, side, 3.95], [-8.5, side, 3.95]], '#a0aaa9');
        for (const axle of [-6.7, -5.4, 3.4, 4.7, 7.3]) {
          const w = vertex(axle, side, .49);
          if (w.z < SVG_CAMERA.near) continue;
          const q = projectPoint(w), radius = SVG_CAMERA.focal * .49 / w.z;
          body += `<ellipse cx="${q.x}" cy="${q.y}" rx="${radius * .45}" ry="${radius}" fill="#162027"/><ellipse cx="${q.x}" cy="${q.y}" rx="${radius * .23}" ry="${radius * .55}" fill="#879397"/>`;
        }
        body += face([[5, side, .8], [8.5, side, .8], [8.5, side, 3.3], [5, side, 3.6]], '#627783');
        body += face([[6.7, side, 2.05], [8.1, side, 2.05], [8.1, side, 2.95], [6.7, side, 3.08]], '#213743');
      }
      body += face([[-8.5, -1.27, 3.95], [4.7, -1.27, 3.95], [4.7, 1.27, 3.95], [-8.5, 1.27, 3.95]], '#c9cfca');
    }
    objects.push({ z: p.z, svg: `${body}<g data-vehicle="${car.id}" data-kind="${car.kind}" transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})">${trafficCarSvg(car, sim.time)}</g>` });
  }
  for (const cyclist of sim.cyclists) {
    const p = camera(cyclist.s, -lanes.surface + .45);
    if (p.z < SVG_CAMERA.near || p.z > 145) continue;
    const q = projectPoint(p), scale = SVG_CAMERA.focal / p.z;
    objects.push({ z: p.z, svg: `<g data-cyclist="${cyclist.id}" transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})">${cyclistSvg(cyclist.id, sim.time)}</g>` });
  }
  // Cross traffic uses the same world positions as the full simulator.
  for (const car of sim.crossCars) {
    const junction = sim.road.junctions.find(j => j.id === car.junction);
    if (!junction) continue;
    const p = camera(junction.s + car.direction * 1.8, car.x * car.direction);
    if (p.z < SVG_CAMERA.near || p.z > 145) continue;
    const q = projectPoint(p), scale = SVG_CAMERA.focal / p.z;
    objects.push({ z: p.z, svg: `<g transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})"><path d="M-2.35,-.3 V-.7 Q-2.3,-.86 -1.65,-.88 L-1,-1.4 Q-.8,-1.5 .5,-1.42 L1.3,-.85 L2.1,-.72 Q2.35,-.65 2.35,-.32Z" fill="#a2afba" stroke="#233543" stroke-width=".04"/><path d="M-1.4,-.9 L-.91,-1.3 H.45 L1.02,-.9Z" fill="#162d40"/><path d="M-.1,-1.3 V-.88" stroke="#738794" stroke-width=".07"/><circle cx="-1.4" cy="-.12" r=".26" fill="#0b1521"/><circle cx="1.4" cy="-.12" r=".26" fill="#0b1521"/></g>` });
  }
  let furniture = '';
  for (const junction of sim.road.junctions) {
    const distance = sim.road.distance(start, junction.s - 12);
    if (distance > 150) continue;
    const base = lanes.offsets[sim.ego.lane];
    markings += pathElement(strip(distance - .2, distance + .2, base - 1.7, base + 1.7), '#f1f5f9');
    const p = camera(junction.s - 12, -lanes.surface - 0.65);
    if (p.z < SVG_CAMERA.near || p.z > 150) continue;
    const q = projectPoint(p), scale = SVG_CAMERA.focal / p.z;
    const signal = sim.signal(junction.id);
    const sign = junction.kind === 'stop'
      ? '<path d="M-.25,-3.6 L.25,-3.6 L.6,-3.25 L.6,-2.75 L.25,-2.4 L-.25,-2.4 L-.6,-2.75 L-.6,-3.25 Z" fill="#e52d39" stroke="white" stroke-width=".065"/><text y="-2.89" text-anchor="middle" font-family="sans-serif" font-size=".33" font-weight="800" fill="white">STOP</text>'
      : `<rect x="-.32" y="-4" width=".64" height="1.65" rx=".13" fill="#091624" stroke="#8495a5" stroke-width=".045"/>${(['red', 'amber', 'green'] as const).map((phase, i) => `<circle cy="${-3.68 + i * .5}" r=".18" fill="${signal === phase ? { red: '#ff626b', amber: '#f9cc65', green: '#66edb1' }[phase] : '#25313e'}"/>`).join('')}`;
    furniture += `<g transform="translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${scale.toFixed(4)})"><path d="M0,0 V-3" stroke="#8294a4" stroke-width=".09"/>${sign}</g>`;
  }
  return { road: strip(0, 150, -lanes.surface, lanes.surface), shoulder: strip(0, 150, -lanes.verge, lanes.verge), markings, intersections, laneLines, path, pathFade, leadArrow,
    traffic: objects.sort((a, b) => b.z - a.z).map(o => o.svg).join(''), furniture, scenery: renderScenery(sim, camera) };
}
