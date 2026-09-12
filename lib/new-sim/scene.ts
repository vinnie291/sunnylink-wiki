import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Simulation, type SimOptions, type Vehicle } from './simulation';

const C = { green: '#189a79', glass: '#34474e', tree: '#9cafa0' };
/** Each layout gets its own ground, asphalt, verge and haze. */
const PALETTES = {
  city: { ground: '#e6e9e2', road: '#858e90', walk: '#d9ddd8', line: '#f6f5eb', fog: [120, 390] },
  boulevard: { ground: '#e9ece1', road: '#8b9392', walk: '#dfe4d6', line: '#f6f5eb', fog: [150, 470] },
  curves: { ground: '#d8e1cb', road: '#7b8480', walk: '#c1cdac', line: '#eef0e4', fog: [70, 250] },
  highway: { ground: '#e4e8e3', road: '#8b9394', walk: '#d5dad4', line: '#f6f5eb', fog: [150, 520] },
};
/** Dusk palettes on the wiki's slate ramp, for the site's dark theme. */
const NIGHT_PALETTES = {
  city: { ground: '#161f2e', road: '#2b3648', walk: '#1e2938', line: '#c8d2e0', fog: [110, 340] },
  boulevard: { ground: '#182131', road: '#2e394b', walk: '#212c3c', line: '#c8d2e0', fog: [140, 420] },
  curves: { ground: '#131c25', road: '#28323f', walk: '#1a2530', line: '#b9c6cf', fog: [65, 220] },
  highway: { ground: '#151d2b', road: '#2d3849', walk: '#1f2a39', line: '#ccd6e3', fog: [140, 460] },
};
/** Structures, planting and trim, dusk versions. */
const NIGHT_TINTS: Record<string, string> = {
  '#9cafa0': '#3c5347', '#9eaf99': '#405746', '#8a9484': '#38443c', '#6f6551': '#3a3630',
  '#6f8a6b': '#2f4638', '#5d7c60': '#2a4034', '#83a37c': '#37503f', '#a8a087': '#4a4a44',
  '#cdd4cf': '#2c3542', '#c2ccc7': '#28313f', '#d3d9d2': '#2f3846', '#c8d1cb': '#2a3341',
  '#e1e5df': '#394452', '#e4e8e1': '#394452', '#9db2b4': '#4d6b7a', '#8fa7ae': '#44606e',
  '#93a29b': '#4b5766', '#9aa79f': '#4f5c6b', '#e8ece5': '#f4e3b6', '#eef1e9': '#f6e6bd',
  '#c8cdc6': '#3f4a58', '#8e9a95': '#454f5e', '#2f6a4f': '#1f4a38', '#3d5f4e': '#2a4a3c',
  '#a5a89c': '#3d4550', '#e6e6dc': '#c9d3de', '#bfd0ac': '#26372c', '#dfe3d6': '#38424f',
  '#b9ae94': '#3c4048', '#798787': '#4a5563', '#667874': '#3d4855', '#263837': '#161d26',
  '#8a7a5e': '#463f36', '#5a5136': '#3a3628', '#4d7167': '#28453c', '#e9d69b': '#8f7f52',
  '#b95249': '#7d3630', '#a7b9b8': '#40525c', '#7a6a52': '#413a30',
};
const hash = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
export class DrivingScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 1, 0.5, 1100);
  root = new THREE.Group();
  private cars = new Map<number, THREE.Group>();
  private crossCars = new Map<number, THREE.Group>();
  private signals: { id: number; cross: boolean; lights: THREE.Mesh[] }[] = [];
  private path: THREE.Mesh;
  private laneLines: THREE.Mesh;
  private roadEdges: THREE.Mesh;
  private sun = new THREE.DirectionalLight('#fff9ec', 3.2);
  private unitBox = new THREE.BoxGeometry(1, 1, 1);
  private rounded = new RoundedBoxGeometry(1, 1, 1, 3, 0.15);
  private tire = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 14);
  private flatCache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  private rim = new THREE.CylinderGeometry(0.23, 0.23, 0.255, 10);
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private palette = PALETTES.city;
  private night = false;
  private glow?: THREE.Texture;
  private egoPaint: THREE.MeshStandardMaterial[] = [];
  private paintedColor = '';
  private labels: THREE.Texture[] = [];
  private followTarget = new THREE.Vector3();
  private lastCamera = '';
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, public sim: Simulation, private theme: 'dark' | 'light' = 'light') {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = theme === 'dark' ? 1.08 : 1.15;
    const night = theme === 'dark';
    this.night = night;
    this.palette = (night ? NIGHT_PALETTES : PALETTES)[sim.options.scenario] ?? PALETTES.city;
    this.scene.background = new THREE.Color(this.palette.ground);
    this.scene.fog = new THREE.Fog(this.palette.ground, this.palette.fog[0], this.palette.fog[1]);
    // Night still needs enough sky and bounce light to read shapes and depth;
    // a literally dark scene is unusable, so this is dusk rather than midnight.
    this.scene.add(new THREE.HemisphereLight(night ? '#5c76a8' : '#e7f3ff', night ? '#2b3444' : '#a8ad9b', night ? 2.5 : 2.4));
    if (night) this.scene.add(new THREE.AmbientLight('#7d90b8', 0.55));
    if (night) { this.sun.color.set('#a8bde6'); this.sun.intensity = 1.35; }
    this.sun.position.set(-45, 80, -30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -75, right: 75, top: 90, bottom: -65, near: 1, far: 220 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target, this.root);
    this.buildRoad();
    this.buildEnvironment();
    for (const car of sim.cars) {
      const mesh = this.buildCar(car.kind, car.id === 0 ? sim.options.carColor : ['#899da4', '#c5c9c8', '#667b81', '#b6b6a5'][car.id % 4], car.id === 0);
      this.cars.set(car.id, mesh); this.root.add(mesh);
    }
    for (const car of sim.crossCars) {
      const mesh = this.buildCar(car.id % 3 === 0 ? 'suv' : 'sedan', '#a0afb2');
      this.crossCars.set(car.id, mesh); this.root.add(mesh);
    }
    this.path = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#28b69a', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
    this.path.renderOrder = 2;
    this.root.add(this.path);
    this.laneLines = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    this.roadEdges = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
    this.laneLines.renderOrder = 3; this.roadEdges.renderOrder = 3;
    this.root.add(this.laneLines, this.roadEdges);
    this.update(0, sim.options);
  }
  /** Un-indexed copy of a shared geometry, cached: mergeGeometries needs a
   * consistent index across a batch, and re-converting per part is wasteful. */
  private flat(geometry: THREE.BufferGeometry) {
    let cached = this.flatCache.get(geometry);
    if (!cached) { cached = geometry.index ? geometry.toNonIndexed() : geometry; this.flatCache.set(geometry, cached); }
    return cached;
  }
  /** Soft radial falloff used for every lamp and headlight pool. */
  private glowTexture() {
    if (!this.glow) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.45, 'rgba(255,255,255,0.42)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
      this.glow = new THREE.CanvasTexture(canvas);
      this.glow.colorSpace = THREE.SRGBColorSpace;
    }
    return this.glow;
  }
  /** A pool of light lying on the road. Additive, so it brightens what it covers. */
  private pool(parent: THREE.Object3D, x: number, y: number, z: number, width: number, length: number, color: string, opacity: number) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshBasicMaterial({
      map: this.glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
      // Road markings, crosswalks and the asphalt all sit within a few
      // centimetres of each other; without a depth bias the pools z-fight with
      // them and strobe as the camera moves.
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, depthTest: true,
    }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.renderOrder = 1;
    parent.add(mesh); return mesh;
  }
  private emissive(color: string, intensity: number) {
    const key = `emissive-${color}-${intensity}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 }));
    }
    return this.materials.get(key)!;
  }
  /** Post, arm, lit head — and after dark, the glow and the pool it casts. */
  private streetLamp(parent: THREE.Object3D, reach: number, height: number, headSize = 0.6) {
    this.box(parent, 0, height / 2, 0, 0.09, height, 0.09, '#93a29b');
    this.box(parent, reach / 2, height, 0, Math.abs(reach), 0.09, 0.09, '#93a29b');
    const head = new THREE.Mesh(this.unitBox, this.night ? this.emissive('#ffd89a', 2.6) : this.material('#e8ece5', 0.28, 0.22));
    head.position.set(reach, height - 0.05, 0); head.scale.set(headSize, 0.12, 0.3); parent.add(head);
    if (this.night) {
      this.pool(parent, reach, height - 0.18, 0, 3.4, 3.4, '#ffcf8e', 0.5);
      this.pool(parent, reach, 0.16, 0, 13, 13, '#ffc987', 0.34);
    }
  }
  private material(color: string, roughness = 0.65, metalness = 0) {
    if (this.theme === 'dark') color = NIGHT_TINTS[color] ?? color;
    const key = `${color}-${roughness}-${metalness}`;
    if (!this.materials.has(key)) {
      // Paint sits 2 cm above asphalt, which is inside the depth buffer's noise
      // at distance; bias it so stripes never strobe against the road.
      const marking = color === this.palette.line || color === '#e9d69b' || color === '#8f7f52';
      this.materials.set(key, new THREE.MeshStandardMaterial({
        color, roughness, metalness,
        ...(marking ? { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 } : {}),
      }));
    }
    return this.materials.get(key)!;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string | THREE.MeshStandardMaterial, round = false) {
    const material = typeof color === 'string' ? this.material(color, round ? 0.28 : 0.75, round ? 0.22 : 0) : color;
    const mesh = new THREE.Mesh(round ? this.rounded : this.unitBox, material);
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  private ribbon(from: number, to: number, left: number, right: number, y: number, step = 2, offsetAt?: (s: number) => number) {
    const positions: number[] = [], indices: number[] = [];
    const count = Math.ceil((to - from) / step);
    for (let i = 0; i <= count; i++) {
      const s = THREE.MathUtils.lerp(from, to, i / count);
      for (const offset of [left, right]) {
        const p = this.sim.road.point(s, offset + (offsetAt?.(s) ?? 0)); positions.push(p.x, y, p.z);
      }
      if (i < count) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2)); g.setIndex(indices); g.computeVertexNormals();
    return g;
  }
  private roadMesh(g: THREE.BufferGeometry, color: string) {
    const mesh = new THREE.Mesh(g, this.material(color)); mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  private atRoad(s: number, offset = 0) {
    const group = new THREE.Group(); group.position.copy(this.sim.road.point(s, offset));
    const t = this.sim.road.tangent(s); group.rotation.y = Math.atan2(t.x, t.z); this.root.add(group); return group;
  }
  private buildRoad() {
    const length = this.sim.road.length;
    const lanes = this.sim.road.lanes;
    const highway = this.sim.options.scenario === 'highway';
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6400, 6400), this.material(this.palette.ground));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.035; ground.receiveShadow = true; this.root.add(ground);
    this.roadMesh(this.ribbon(0, length, -lanes.verge, lanes.verge, 0, highway ? 4 : 2), this.palette.walk);
    this.roadMesh(this.ribbon(0, length, -lanes.surface, lanes.surface, 0.035, highway ? 4 : 2), this.palette.road);
    const markings: THREE.BufferGeometry[] = [];
    const uninterrupted: [number, number][] = [];
    let begin = 0;
    for (const j of this.sim.road.junctions) { uninterrupted.push([begin, j.s - 8]); begin = j.s + 8; }
    uninterrupted.push([begin, length]);
    if (lanes.edgeLine > 0) {
      for (const [from, to] of uninterrupted) {
        for (const edge of [-lanes.edgeLine, lanes.edgeLine]) markings.push(this.ribbon(from, to, edge - 0.07, edge + 0.07, 0.055, highway ? 4 : 2));
      }
    }
    // Dashed lane dividers: longer strokes and wider gaps at highway speed.
    const dash = highway ? 14 : 9, stroke = highway ? 5 : 3;
    for (let s = 0; s < length; s += dash) {
      if (this.sim.road.junctions.some(j => Math.abs(s - j.s) < 12)) continue;
      for (const lane of lanes.dividers) markings.push(this.ribbon(s, s + stroke, lane - 0.065, lane + 0.065, 0.06));
    }
    if (markings.length) { this.roadMesh(mergeGeometries(markings)!, this.palette.line); markings.forEach(g => g.dispose()); }
    if (lanes.centerLine) {
      for (const [from, to] of uninterrupted) {
        for (const x of [-0.16, 0.16]) this.roadMesh(this.ribbon(from, to, x - 0.045, x + 0.045, 0.065), '#e9d69b');
      }
    }
    if (lanes.median !== null) {
      for (const [from, to] of uninterrupted) {
        this.roadMesh(this.ribbon(from, to, -lanes.median, lanes.median, 0.16), '#bfd0ac');
        for (const curb of [-lanes.median, lanes.median]) this.roadMesh(this.ribbon(from, to, curb - 0.12, curb + 0.12, 0.19), '#dfe3d6');
      }
    }
    if (lanes.barrier !== null) this.buildBarrier(lanes.barrier);
    if (highway) this.buildHighwayFurniture();
    // Junction furniture scales with the carriageway: a 3.4 m forest lane and a
    // 9 m boulevard cannot share one hardcoded intersection.
    const w = lanes.surface;
    const paved = this.sim.options.scenario !== 'curves';
    for (const j of this.sim.road.junctions) {
      const intersection = this.atRoad(j.s);
      this.box(intersection, 0, 0.025, 0, 120, 0.06, w * 2 + 0.4, this.palette.road);
      for (const z of [-w, w]) this.box(intersection, 0, 0.02, z, 120, 0.04, 0.16, this.palette.line);
      for (const side of [-1, 1]) {
        this.box(intersection, -side * (w / 2), 0.08, -side * (w + 4.7), w, 0.035, 0.5, this.palette.line);
        if (paved) {
          for (let x = -(w + 1.2); x <= w + 1.2; x += 1.25) this.box(intersection, x, 0.08, side * (w + 2.1), 0.65, 0.035, 2.3, this.palette.line);
        }
        if (j.kind === 'signal') {
          const signal = new THREE.Group(); signal.position.set(-side * (w + 1), 0, side * (w + 3.2)); signal.rotation.y = side === 1 ? 0 : Math.PI;
          intersection.add(signal); this.buildSignal(signal, j.id, false);
          const cross = new THREE.Group(); cross.position.set(side * (w + 3.7), 0, side * (w + 1.2)); cross.rotation.y = side * Math.PI / 2;
          intersection.add(cross); this.buildSignal(cross, j.id, true);
        } else {
          const sign = new THREE.Group(); sign.position.set(-side * (w + 1), 0, -side * (w + 4.7)); sign.rotation.y = side === 1 ? Math.PI : 0;
          intersection.add(sign);
          this.box(sign, 0, 1.5, 0, 0.09, 3, 0.09, '#798787');
          const face = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.09, 8), this.material('#b95249'));
          face.rotation.x = Math.PI / 2; face.rotation.z = Math.PI / 8; face.position.y = 2.8; sign.add(face);
          this.label(sign, 'STOP', 0, 2.8, 0.06, 0.88, 0.42, '#ffffff', '#b95249');
        }
      }
      const street = this.atRoad(j.s - 18, -(lanes.verge - 0.3));
      this.box(street, 0, 2.6, 0, 0.08, 5.2, 0.08, paved ? '#778785' : '#7a6a52');
      street.rotation.y += Math.PI;
      this.label(street, j.name.toUpperCase(), 0, 4.8, 0, 4.1, 0.8, '#ffffff', paved ? '#4d7167' : '#5a5136');
    }
  }
  /** Continuous concrete median barrier along the left edge of a highway. */
  private buildBarrier(offset: number) {
    const length = this.sim.road.length;
    const segments: THREE.BufferGeometry[] = [];
    for (let s = 0; s < length; s += 20) {
      const span = Math.min(20.1, length - s);
      segments.push(this.ribbon(s, s + span, offset - 0.28, offset + 0.28, 0.86, span));
      for (const edge of [offset - 0.3, offset + 0.3]) {
        const wall = this.ribbon(s, s + span, edge, edge, 0, span);
        // Extrude the side wall by lifting one edge of the strip.
        const position = wall.getAttribute('position');
        for (let i = 1; i < position.count; i += 2) position.setY(i, 0.86);
        position.needsUpdate = true; wall.computeVertexNormals();
        segments.push(wall);
      }
    }
    const merged = mergeGeometries(segments);
    if (merged) {
      const mesh = new THREE.Mesh(merged, this.material('#c8cdc6', 0.9));
      mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    }
    segments.forEach(g => g.dispose());
  }
  /** Overhead sign gantries and mile markers give the highway a sense of speed. */
  private buildHighwayFurniture() {
    const length = this.sim.road.length;
    const lanes = this.sim.road.lanes;
    for (let s = 0; s < length; s += 620) {
      const gantry = this.atRoad(s, 0);
      for (const side of [-1, 1]) this.box(gantry, side * (lanes.surface - 0.6), 3.4, 0, 0.42, 6.8, 0.42, '#8e9a95');
      this.box(gantry, 0, 6.5, 0, lanes.surface * 2, 0.36, 0.5, '#8e9a95');
      // The sign board faces oncoming traffic, so it hangs in a group turned to
      // look back down the road; a label left facing +Z reads mirrored.
      const board = new THREE.Group();
      board.rotation.y = Math.PI;
      gantry.add(board);
      this.box(board, 0, 5.4, -0.05, 7.4, 1.9, 0.22, '#2f6a4f');
      this.label(board, `EXIT ${Math.round(s / 100) + 12}`, 0, 5.4, 0.14, 6.6, 1.5, '#ffffff', '#2f6a4f');
    }
    for (let s = 0; s < length; s += 160) {
      const marker = this.atRoad(s + 40, -(lanes.verge + 1.6));
      this.box(marker, 0, 1.1, 0, 0.09, 2.2, 0.09, '#9aa79f');
      this.box(marker, 0, 2.2, 0, 0.62, 0.5, 0.06, '#3d5f4e');
    }
  }
  private label(parent: THREE.Object3D, text: string, x: number, y: number, z: number, w: number, h: number, fg: string, bg: string) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = fg; ctx.font = '600 47px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 66, 480);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.labels.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z); parent.add(mesh);
  }
  private buildSignal(group: THREE.Group, id: number, cross: boolean) {
    this.box(group, 0, 2.9, 0, 0.14, 5.8, 0.14, '#667874');
    this.box(group, 2.2, 5.65, 0, 4.5, 0.12, 0.12, '#667874');
    this.box(group, 4.2, 5.2, 0, 0.66, 1.8, 0.4, '#263837', true);
    const lights: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: '#263837' }));
      mesh.position.set(4.2, 5.75 - i * 0.53, -0.27); mesh.rotation.y = Math.PI;
      group.add(mesh); lights.push(mesh);
      this.box(group, 4.2, 5.95 - i * 0.53, -0.34, 0.52, 0.07, 0.45, '#263837');
    }
    this.signals.push({ id, cross, lights });
  }
  private buildEnvironment() {
    const scenario = this.sim.options.scenario;
    if (scenario === 'city') this.buildCityBlocks();
    else if (scenario === 'boulevard') this.buildBoulevardScenery();
    else if (scenario === 'curves') this.buildForest();
    else this.buildHighwayScenery();
    this.batchStatics();
  }
  private clearOfJunctions(s: number, margin: number) {
    return !this.sim.road.junctions.some(j => Math.abs(this.sim.road.distance(s, j.s)) < margin
      || Math.abs(this.sim.road.distance(j.s, s)) < margin);
  }
  /** Broadleaf street tree: trunk plus a lumpy crown. */
  private broadleaf(parent: THREE.Object3D, scale: number, seed: number) {
    this.box(parent, 0, 1.2 * scale, 0, 0.28 * scale, 2.4 * scale, 0.28 * scale, '#8a9484');
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry((2.1 + hash(seed) * 0.9) * scale, 1),
      this.material(seed % 2 ? '#9eaf99' : C.tree));
    crown.scale.y = 1.2; crown.position.y = 3.7 * scale; crown.castShadow = true; parent.add(crown);
  }
  /** Conifer: the forest layout is mostly these, in staggered ranks. */
  private conifer(parent: THREE.Object3D, scale: number, seed: number) {
    this.box(parent, 0, 1.1 * scale, 0, 0.34 * scale, 2.2 * scale, 0.34 * scale, '#6f6551');
    const height = (6.5 + hash(seed) * 4) * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry((1.5 + hash(seed * 3) * 0.7) * scale, height, 7),
      this.material(hash(seed * 7) > 0.5 ? '#6f8a6b' : '#5d7c60'));
    cone.position.y = 2 * scale + height / 2; cone.castShadow = true; parent.add(cone);
  }
  /** Dense frontage right against the sidewalk: an urban canyon, not a suburb. */
  private buildCityBlocks() {
    const { verge } = this.sim.road.lanes;
    for (let s = 0; s < this.sim.road.length; s += 21) {
      if (!this.clearOfJunctions(s, 26)) continue;
      const n = Math.round(s / 21);
      for (const side of [-1, 1]) {
        const seed = n * 2 + (side > 0 ? 1 : 0);
        const height = 8 + Math.floor(hash(seed) * 6) * 3.5;
        const depth = 17 + hash(seed * 5) * 6;
        const block = this.atRoad(s + 4, side * (verge + 1.5 + depth / 2));
        this.box(block, 0, height / 2, 0, 18 + hash(seed * 3) * 4, height, depth, hash(seed * 11) > 0.5 ? '#cdd4cf' : '#c2ccc7');
        this.box(block, 0, height + 0.2, 0, 18.7 + hash(seed * 3) * 4, 0.4, depth + 0.6, '#e1e5df');
        // Window bands facing the street plus a ground-floor shopfront.
        for (let floor = 3.4; floor < height - 1; floor += 3.2) {
          this.box(block, -side * (depth / 2 + 0.02), floor, 0, 0.06, 1.5, 16.2, '#9db2b4');
        }
        this.box(block, -side * (depth / 2 + 0.04), 1.5, 0, 0.06, 2.4, 13.5, '#8fa7ae');
        if (n % 2 === 0) {
          this.streetLamp(this.atRoad(s + 10, side * (verge - 1.1)), -side * 1.3, 5.2);
        } else {
          const tree = this.atRoad(s + 13, side * (verge - 2.4));
          this.box(tree, 0, 0.06, 0, 1.5, 0.1, 1.5, '#b9ae94');
          this.broadleaf(tree, 0.8, seed);
        }
      }
    }
  }
  /** Palms down the median, street trees on both verges, buildings set well back. */
  private buildBoulevardScenery() {
    const { verge } = this.sim.road.lanes;
    for (let s = 0; s < this.sim.road.length; s += 19) {
      const n = Math.round(s / 19);
      if (this.clearOfJunctions(s, 24)) {
        const palm = this.atRoad(s, 0);
        const trunkHeight = 6.5 + hash(n) * 2.5;
        this.box(palm, 0, trunkHeight / 2, 0, 0.34, trunkHeight, 0.34, '#a8a087');
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), this.material('#83a37c'));
        crown.scale.set(1.35, 0.55, 1.35); crown.position.y = trunkHeight + 0.3; crown.castShadow = true; palm.add(crown);
      }
      for (const side of [-1, 1]) {
        const tree = this.atRoad(s + 9, side * (verge - 2.6));
        this.broadleaf(tree, 1, n * 2 + (side > 0 ? 1 : 0));
        if (n % 2 === 0) {
          const lamp = this.atRoad(s, side * (this.sim.road.lanes.median ?? 1.4) * 0.75);
          this.streetLamp(lamp, 1.2, 7);
          this.streetLamp(lamp, -1.2, 7);
        }
        if (n % 3 === 0) {
          const height = 6 + hash(n * 3 + side) * 7;
          const building = this.atRoad(s + 6, side * (verge + 24 + hash(n) * 8));
          this.box(building, 0, height / 2, 0, 26, height, 20, hash(n * 9) > 0.5 ? '#d3d9d2' : '#c8d1cb');
          this.box(building, 0, height + 0.2, 0, 26.8, 0.4, 20.8, '#e4e8e1');
        }
      }
    }
  }
  /** Woods crowding a single-track lane: staggered conifer ranks, rocks, posts. */
  private buildForest() {
    const { verge } = this.sim.road.lanes;
    for (let s = 0; s < this.sim.road.length; s += 15) {
      const n = Math.round(s / 15);
      for (const side of [-1, 1]) {
        for (let rank = 0; rank < 3; rank++) {
          const seed = n * 7 + side * 3 + rank * 31;
          // A ragged back rank reads as woods rather than a planted avenue.
          if (rank === 2 && hash(seed * 17) < 0.45) continue;
          const offset = verge + 1.4 + rank * 6.5 + hash(seed) * 5;
          const tree = this.atRoad(s + hash(seed * 5) * 14, side * offset);
          if (hash(seed * 13) > 0.28) this.conifer(tree, 0.85 + hash(seed * 2) * 0.5, seed);
          else this.broadleaf(tree, 0.9 + hash(seed * 4) * 0.4, seed);
        }
        if (n % 3 === 0) {
          const rock = this.atRoad(s + 5, side * (verge + 0.7));
          const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + hash(n + side) * 0.5, 0), this.material('#a5a89c', 0.95));
          stone.scale.y = 0.7; stone.position.y = 0.25; stone.castShadow = true; rock.add(stone);
        }
        if (n % 2 === 0 && this.clearOfJunctions(s, 14)) {
          // Reflector posts stand in for edge lines on an unmarked lane.
          const post = this.atRoad(s, side * (verge - 0.6));
          this.box(post, 0, 0.5, 0, 0.09, 1, 0.09, '#e6e6dc');
          this.box(post, 0, 0.86, -side * 0.05, 0.11, 0.16, 0.02, '#d2534a');
        }
      }
    }
  }
  /** Sparse roadside planting; the gantries and markers come from buildRoad. */
  private buildHighwayScenery() {
    const { verge } = this.sim.road.lanes;
    for (let s = 0; s < this.sim.road.length; s += 52) {
      const n = Math.round(s / 52);
      // Nothing is planted inside the median, so highway scenery is right-side only.
      const tree = this.atRoad(s, -(verge + 2.2 + (n % 3) * 1.5));
      this.broadleaf(tree, 1, n);
      if (n % 3 === 0) {
        this.streetLamp(this.atRoad(s + 11, -(verge - 1.5)), 1.5, 6.6);
      }
    }
  }
  /** Batch repeated static meshes by material to keep the world cheap to draw. */
  private batchStatics() {
    const batches = new Map<THREE.Material, { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[]>();
    this.root.updateMatrixWorld(true);
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      const list = batches.get(object.material) ?? []; list.push({ mesh: object, geometry }); batches.set(object.material, list);
    });
    for (const [material, meshes] of batches) {
      const merged = mergeGeometries(meshes.map(m => m.geometry));
      if (merged) {
        const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true;
        for (const entry of meshes) { entry.mesh.removeFromParent(); if (entry.mesh.geometry !== this.unitBox && entry.mesh.geometry !== this.rounded) entry.mesh.geometry.dispose(); }
        this.root.add(mesh);
      }
      meshes.forEach(m => m.geometry.dispose());
    }
  }
  /**
   * Cars are merged down to one mesh per material. A rush-hour highway puts 145
   * of them on screen, so a car built from ~28 separate meshes would cost
   * thousands of draw calls a frame. Only the ego keeps steerable front wheels,
   * wheel rims and mirrors; traffic uses the same silhouette without them.
   */
  private buildCar(kind: Vehicle['kind'], color: string, detailed = false) {
    const group = new THREE.Group();
    const body = new THREE.Group();
    body.name = 'bodyGroup';
    group.add(body);

    const tall = kind === 'suv' ? 1.15 : kind === 'van' ? 1.4 : 1;
    const paint = detailed
      ? new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.22 })
      : this.material(color, 0.28, 0.22);
    if (detailed) { this.egoPaint.push(paint); this.paintedColor = color; }
    const brakeMaterial = new THREE.MeshStandardMaterial({
      color: '#401311', emissive: '#ff2214', emissiveIntensity: 0, roughness: 0.25, metalness: 0.2,
    });
    const glass = this.material(C.glass, 0.18, 0.35);
    const under = this.material('#3b494b', 0.28, 0.22);
    const trim = this.material('#586767', 0.28, 0.22);
    // Headlights and tail lights are lit after dark, and throw a pool on the road.
    const lamp = this.night ? this.emissive('#fff2cf', 2.2) : this.material('#f6fff9', 0.28, 0.22);
    const tail = this.night ? this.emissive('#ff5a45', 0.9) : this.material('#e6e9e3', 0.28, 0.22);

    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const push = (material: THREE.Material, geometry: THREE.BufferGeometry) => {
      const list = parts.get(material) ?? []; list.push(geometry); parts.set(material, list);
    };
    const add = (material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const geometry = this.flat(this.rounded).clone();
      geometry.scale(w, h, d); geometry.translate(x, y, z);
      push(material, geometry);
    };

    add(paint, 0, 0.57, 0, 1.88, 0.62, 4.65);
    add(under, 0, 0.38, 0, 1.79, 0.16, 4.4);
    add(paint, 0, 0.85, 1.52, 1.72, 0.2, 1.35);
    // Sloped windshield, tapered pillars and a curved roof, rather than a box cabin.
    const shape = new THREE.Shape();
    shape.moveTo(-1.45, 0.8); shape.lineTo(-0.9, 1.42 * tall); shape.quadraticCurveTo(0, 1.6 * tall, 0.67, 1.43 * tall);
    shape.lineTo(1.33, 0.82); shape.closePath();
    const cabin = new THREE.ExtrudeGeometry(shape, { depth: 1.55, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.06, bevelThickness: 0.06 });
    cabin.rotateY(-Math.PI / 2); cabin.translate(0.775, 0, 0);
    const cabinFlat = cabin.index ? cabin.toNonIndexed() : cabin;
    if (cabinFlat !== cabin) cabin.dispose();
    push(glass, cabinFlat);
    for (const side of [-1, 1]) {
      add(paint, side * 0.73, 1.49 * tall, -0.13, 0.07, 0.08, 1.45);
      add(trim, side * 0.8, 1.14 * tall, -0.25, 0.055, 0.52 * tall, 0.09);
      add(lamp, side * 0.66, 0.73, 2.26, 0.52, 0.095, 0.04);
      add(brakeMaterial, side * 0.63, 0.77, -2.26, 0.57, 0.11, 0.05);
      if (detailed) {
        add(paint, side * 1.02, 1, 0.78, 0.28, 0.14, 0.35);
        add(trim, side * 0.91, 0.84, -0.38, 0.025, 0.04, 0.28);
      }
    }
    // High-mount center stop lamp (CHMSL) above rear windshield
    add(brakeMaterial, 0, 1.45 * tall, -1.35, 0.44, 0.045, 0.05);
    add(tail, 0, 0.48, -2.32, 0.53, 0.15, 0.02);

    for (const [material, list] of parts) {
      const merged = mergeGeometries(list);
      list.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      // Only the painted shell casts: the shadow pass runs over every car too.
      mesh.castShadow = material === paint;
      if (material === brakeMaterial) mesh.name = 'brake';
      body.add(mesh);
    }

    if (this.night) {
      // Beam pools ride the car, not the body, so they do not pitch under braking.
      this.pool(group, 0, 0.17, 11, 9, 20, '#ffe6b4', 0.5);
      this.pool(group, 0, 0.17, -4.6, 4.5, 5, '#ff6a52', 0.28);
    }
    const tireMaterial = this.material('#263131');
    // Front wheels sit at z = 1.45, rear drive wheels at z = -1.48.
    for (const z of [1.45, -1.48]) {
      const steerable = z > 0;
      if (detailed) {
        for (const side of [-1, 1]) {
          const mount = new THREE.Group();
          mount.name = steerable ? 'steerPivot' : 'wheelAxle';
          mount.position.set(side * 0.91, 0.36, z);
          group.add(mount);

          const roll = new THREE.Group();
          roll.name = 'wheelRoll';
          mount.add(roll);

          const tire = new THREE.Mesh(this.tire, tireMaterial);
          tire.rotation.z = Math.PI / 2; tire.castShadow = true; roll.add(tire);

          const rim = new THREE.Mesh(this.rim, this.material('#aebaba', 0.3, 0.7));
          rim.rotation.z = Math.PI / 2; rim.position.x = side * 0.018; roll.add(rim);
        }
      } else {
        // Both wheels on an axle share one roll axis, so they share one mesh.
        const axle = new THREE.Group();
        axle.name = 'wheelRoll';
        axle.position.set(0, 0.36, z);
        group.add(axle);
        const tires = [-1, 1].map(side => {
          const geometry = this.flat(this.tire).clone();
          geometry.rotateZ(Math.PI / 2); geometry.translate(side * 0.91, 0, 0);
          return geometry;
        });
        const merged = mergeGeometries(tires);
        tires.forEach(geometry => geometry.dispose());
        if (merged) { const mesh = new THREE.Mesh(merged, tireMaterial); mesh.castShadow = true; axle.add(mesh); }
      }
    }

    return group;
  }
  resize(width: number, height: number) {
    if (!width || !height) return;
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  /** Shortest-path blend between two arc positions on a closed loop. */
  private blend(from: number, to: number, alpha: number) {
    const length = this.sim.road.length;
    let delta = to - from;
    if (delta > length / 2) delta -= length;
    else if (delta < -length / 2) delta += length;
    return from + delta * alpha;
  }
  /**
   * `alpha` is how far the renderer is between the last two fixed steps. The
   * simulation runs at a fixed 60 Hz while frames arrive at whatever rate the
   * display uses, so drawing raw step positions stutters on every display that
   * is not exactly 60 Hz. Interpolating between the two states removes it.
   */
  update(dt: number, options: SimOptions, alpha = 1) {
    if (this.disposed) return;
    const sim = this.sim;
    const at = (car: Vehicle) => this.blend(car.prevS, car.s, alpha);
    const across = (car: Vehicle) => sim.road.lanes.offsets[car.lane]
      + car.prevLateral + (car.lateral - car.prevLateral) * alpha;
    const egoS = at(sim.ego);
    if (options.carColor !== this.paintedColor) {
      this.paintedColor = options.carColor;
      for (const material of this.egoPaint) material.color.set(options.carColor);
    }
    for (const car of sim.cars) {
      const group = this.cars.get(car.id)!;
      const s = at(car);
      group.position.copy(sim.road.point(s, across(car)));
      const tangent = sim.road.tangent(s).multiplyScalar(car.direction);
      group.rotation.y = Math.atan2(tangent.x, tangent.z) + (car.id === 0 ? car.prevHeading + (car.headingError - car.prevHeading) * alpha : 0);

      // Physical steering angle for front wheels
      const steerAngle = car.id === 0 ? car.prevSteering + (car.steeringAngle - car.prevSteering) * alpha : sim.computeSteerAngle(car);
      const rollDelta = options.playing ? (car.speed * dt * options.rate) / 0.35 : 0;

      // Realistic suspension pitch (brake dive / accel squat) and curve body roll
      const targetPitch = THREE.MathUtils.clamp(-car.acceleration * 0.015, -0.05, 0.04);
      const curvature = sim.road.curvature(s);
      const lateralG = car.id === 0 ? car.yawRate * car.speed : (car.speed ** 2) * curvature * Math.sign(steerAngle);
      const targetRoll = THREE.MathUtils.clamp(lateralG * 0.012, -0.04, 0.04);

      group.traverse(o => {
        if (o.name === 'steerPivot') {
          o.rotation.y = steerAngle;
        } else if (o.name === 'wheelRoll') {
          o.rotation.x = (o.rotation.x + rollDelta) % (Math.PI * 2);
        } else if (o.name === 'bodyGroup') {
          o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, targetPitch, Math.min(1, dt * 8));
          o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, targetRoll, Math.min(1, dt * 8));
        } else if (o.name === 'brake') {
          const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.color.set(car.braking ? '#ff1e10' : '#320b0a');
        }
      });
    }
    for (const car of sim.crossCars) {
      const junction = sim.road.junctions.find(j => j.id === car.junction)!;
      const group = this.crossCars.get(car.id)!;
      const x = car.prevX + (car.x - car.prevX) * alpha;
      group.position.copy(sim.road.point(junction.s + car.direction * 1.8, x * car.direction));
      const t = sim.road.tangent(junction.s); group.rotation.y = Math.atan2(t.z * car.direction, -t.x * car.direction);
      const rollDelta = options.playing ? (car.speed * dt * options.rate) / 0.35 : 0;
      const allowed = sim.crossCanProceed(car.junction);
      const boundary = allowed || car.x > -13 ? 65 : -14;
      const isCrossBraking = car.x >= boundary - 0.5 || car.x < -68;
      group.traverse(o => {
        if (o.name === 'wheelRoll') {
          o.rotation.x = (o.rotation.x + rollDelta) % (Math.PI * 2);
        } else if (o.name === 'brake') {
          const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.color.set(isCrossBraking ? '#ff1e10' : '#320b0a');
        }
      });
    }
    for (const signal of this.signals) {
      const phase = signal.cross ? sim.crossCanProceed(signal.id) ? 'green' : 'red' : sim.signal(signal.id);
      signal.lights.forEach((light, i) => (light.material as THREE.MeshBasicMaterial).color.set(
        phase === ['red', 'amber', 'green'][i] ? ['#ff5548', '#ffca56', '#40efab'][i] : '#354440'));
    }
    // Lane lines and road edges, as the openpilot overlay draws them: the ego
    // lane's two boundaries bright, the outer edges of the asphalt faint.
    this.laneLines.visible = options.perception;
    this.roadEdges.visible = options.perception;
    if (options.perception) {
      const lanes = sim.road.lanes;
      const width = lanes.offsets.length > 1 ? Math.abs(lanes.offsets[0] - lanes.offsets[1]) : 3.6;
      // The road's own lane centre, not the ego's biased position: the point is
      // to see how far a model sits off centre inside its lane.
      const centre = lanes.offsets[sim.ego.lane];
      const from = egoS + 1, to = egoS + 78;
      const strips = (offsets: number[], half: number) => {
        const parts = offsets.map(offset => this.ribbon(from, to, offset - half, offset + half, 0.075, 3));
        const merged = mergeGeometries(parts)!;
        parts.forEach(part => part.dispose());
        return merged;
      };
      this.laneLines.geometry.dispose();
      this.laneLines.geometry = strips([centre - width / 2, centre + width / 2], 0.08);
      this.roadEdges.geometry.dispose();
      this.roadEdges.geometry = strips([-lanes.surface + 0.15, lanes.surface - 0.15], 0.06);
    }
    this.path.visible = options.path;
    if (options.path) {
      (this.path.material as THREE.MeshBasicMaterial).color.set(sim.model.pathColor);
      const lead = sim.lead(sim.ego);
      const next = sim.nextJunction(sim.ego);
      let distance = Math.min(85, Math.max(4, lead.gap));
      if (next && ((next.kind === 'stop' && sim.ego.released !== next.id) || (next.kind === 'signal' && sim.signal(next.id) !== 'green'))) distance = Math.min(distance, next.distance - 1);
      this.path.geometry.dispose();
      this.path.geometry = this.ribbon(egoS + 2.4, egoS + Math.max(3, distance), -0.75, 0.75, 0.09, 1.5, s => sim.plannedLaneOffset(s - egoS));
    }
    const ego = this.cars.get(0)!;
    ego.visible = options.camera !== 'driver';
    const tangent = sim.road.tangent(egoS);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const desired = ego.position.clone();
    // Aim down the lane the ego actually occupies. Anything anchored to a fixed
    // offset points off the road on a layout whose ego lane is not the city one.
    const lane = across(sim.ego);
    const narrow = this.width / this.height < 1;
    let look = sim.road.point(egoS + 18, lane);
    if (options.camera === 'follow') {
      // Shoulder the camera slightly right of the lane and lead the same amount
      // to the left, so the car sits just off centre with its path in frame.
      const shoulder = narrow ? 0 : 4;
      desired.addScaledVector(tangent, narrow ? -23 : -18).addScaledVector(right, shoulder); desired.y = narrow ? 15 : 12;
      look = sim.road.point(egoS + 20, lane + shoulder * 0.45);
    } else if (options.camera === 'overview') {
      desired.addScaledVector(tangent, -45).addScaledVector(right, 25); desired.y = 83;
      look = sim.road.point(egoS + 25, lane);
    } else { desired.addScaledVector(tangent, 0.7); desired.y = 1.65; look.y = 1.35; }
    const follow = this.lastCamera !== options.camera || dt === 0 ? 1 : 1 - Math.exp(-dt * 4);
    this.camera.position.lerp(desired, follow); this.followTarget.lerp(look, follow);
    this.camera.lookAt(this.followTarget); this.lastCamera = options.camera;
    this.sun.position.copy(ego.position).add(new THREE.Vector3(-45, 80, -30)); this.sun.target.position.copy(ego.position);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>([this.unitBox, this.rounded, this.tire, this.rim, ...this.flatCache.values()]);
    const materials = new Set<THREE.Material>(this.materials.values());
    this.scene.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.labels.forEach(t => t.dispose()); this.glow?.dispose();
    this.sun.shadow.dispose(); this.renderer.dispose();
  }
}
