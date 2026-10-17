// One hole: an island arena (heightfield + surfaces) and every gimmick on it.
import * as THREE from 'three';
import * as M from './models.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// distance from (x, z) to a polyline of {x, z} points; s is the distance along it
function polyInfo(pts, x, z) {
  let best = Infinity, s = 0, acc = 0, seg = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z, L = Math.hypot(abx, abz);
    let t = ((x - a.x) * abx + (z - a.z) * abz) / (L * L);
    t = Math.min(1, Math.max(0, t));
    const dx = x - (a.x + abx * t), dz = z - (a.z + abz * t);
    const d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; s = acc + t * L; seg = i; }
    acc += L;
  }
  return { d: Math.sqrt(best), s, seg, total: acc };
}

const COLORS = {
  fairway: [0x74d63f, 0x6acb38], green: 0x93e85a, rough: 0x3f9e2e, sand: 0xf0dfa4,
  beach: 0xf3e3ae, shallow: 0xd8cf98, deep: 0x1f7a8a, rock: 0xa08d68, snow: 0xf4f1e4,
};
export const SNAKE_R = 7.5, ELEPHANT_R = 10;

export class World {
  constructor(hole, index) {
    this.hole = hole;
    this.rand = mulberry32(1234 + index * 977);
    this.group = new THREE.Group();
    this.path = hole.path.map(([x, z]) => ({ x, z }));
    this.total = polyInfo(this.path, 0, 0).total;
    this.land = hole.land;
    this.bunkers = hole.bunkers || [];
    this.ponds = hole.ponds || [];
    this.moats = hole.moats || [];
    this.hills = hole.hills || [];
    this.mountains = hole.mountains || [];
    this.streams = (hole.streams || []).map(st => {
      const pts = st.pts.map(([x, z]) => ({ x, z }));
      return { w: st.w, pts, total: polyInfo(pts, pts[0].x, pts[0].z).total };
    });
    const t = this.path[0], c = this.path[this.path.length - 1];
    this.teeH = this.rawHeight(t.x, t.z);
    this.greenH = this.rawHeight(c.x, c.z) + 0.1;
    this.tee = new THREE.Vector3(t.x, this.height(t.x, t.z), t.z);
    this.cup = new THREE.Vector3(c.x, this.height(c.x, c.z), c.z);
    const m = 30;
    this.minX = Math.min(...this.land.map(([x, , r]) => x - r)) - m;
    this.maxX = Math.max(...this.land.map(([x, , r]) => x + r)) + m;
    this.minZ = Math.min(...this.land.map(([, z, r]) => z - r)) - m;
    this.maxZ = Math.max(...this.land.map(([, z, r]) => z + r)) + m;

    this.buildTerrain();
    this.buildCup();
    this.buildWebs();
    this.buildBelts();
    this.buildPads();
    this.buildPortals();
    this.buildMysteries();
    this.buildElephants();
    this.buildSnakes();
    this.buildTrees();
    this.buildBubbles();
    this.buildFlies();
    this.bursts = [];
  }

  // ---------- geometry queries ----------
  pathInfo(x, z) { return polyInfo(this.path, x, z); }
  pointAtS(s) {
    s = Math.min(this.total, Math.max(0, s));
    let acc = 0;
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i], b = this.path[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (s <= acc + L + 1e-6) {
        const k = (s - acc) / L, x = lerp(a.x, b.x, k), z = lerp(a.z, b.z, k);
        return new THREE.Vector3(x, this.height(x, z), z);
      }
      acc += L;
    }
    return this.cup.clone();
  }
  // signed distance to the island edge (negative inside)
  landSD(x, z) {
    let d = Infinity;
    for (const [lx, lz, r] of this.land) d = smin(d === Infinity ? 1e6 : d, Math.hypot(x - lx, z - lz) - r, 18);
    return d + 3 * Math.sin(x * 0.09 + 1.7) * Math.cos(z * 0.08);
  }
  rawHeight(x, z) {
    let h = 1.5 + 0.6 * Math.sin(x * 0.06 + 1.3) * Math.cos(z * 0.05) + 0.3 * Math.sin(x * 0.15 + z * 0.12);
    for (const [hx, hz, r, hh] of this.hills) h += hh * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (r * r));
    h = Math.max(h, 0.8);
    for (const [mx, mz, r, mh] of this.mountains) {
      const d = Math.hypot(x - mx, z - mz);
      if (d < r) h += mh * smooth(r, r * 0.36, d);
    }
    const e = smooth(-8, 8, this.landSD(x, z));
    h = h * (1 - e) - 3.5 * e;
    for (const [bx, bz, r] of this.bunkers) {
      const k = Math.hypot(x - bx, z - bz) / r;
      if (k < 1.25) h -= 0.45 * smooth(1.25, 0.6, k);
    }
    return h;
  }
  height(x, z) {
    let h = this.rawHeight(x, z);
    const c = this.path[this.path.length - 1], t = this.path[0];
    const dc = Math.hypot(x - c.x, z - c.z);
    if (dc < 16) h = lerp(h, this.greenH, smooth(16, 9, dc));
    const dt = Math.hypot(x - t.x, z - t.z);
    if (dt < 7) h = lerp(h, this.teeH, smooth(7, 3, dt));
    for (const [px, pz, rx, rz] of this.ponds) {
      const k = Math.hypot((x - px) / rx, (z - pz) / rz);
      if (k < 1.35) h = lerp(h, -1.4, smooth(1.35, 0.85, k));
    }
    for (const [mx, mz, r1, r2] of this.moats) {
      const half = (r2 - r1) / 2;
      const k = Math.abs(Math.hypot(x - mx, z - mz) - (r1 + half)) / half;
      if (k < 1.2) h = lerp(h, -1.4, smooth(1.2, 0.8, k));
    }
    for (const st of this.streams) {
      const d = polyInfo(st.pts, x, z).d, hw = st.w / 2;
      if (d < hw + 2.5) h = lerp(h, -1.2, smooth(hw + 2.5, hw - 0.5, d));
    }
    return h;
  }
  normal(x, z) {
    const e = 0.4;
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
  }
  streamAt(x, z) {
    for (const st of this.streams) {
      const info = polyInfo(st.pts, x, z);
      if (info.d < st.w / 2 + 3) return { stream: st, ...info };
    }
    return null;
  }
  inLake(x, z) {
    for (const [px, pz, rx, rz] of this.ponds) if (Math.hypot((x - px) / rx, (z - pz) / rz) < 1.45) return true;
    for (const [mx, mz, r1, r2] of this.moats) {
      const d = Math.hypot(x - mx, z - mz);
      if (d > r1 - 3 && d < r2 + 3) return true;
    }
    return !!this.streamAt(x, z);
  }
  surface(x, z, h = this.height(x, z)) {
    if (h < 0.02) return this.inLake(x, z) ? 'pond' : 'sea';
    const c = this.cup;
    if (Math.hypot(x - c.x, z - c.z) < 11) return 'green';
    for (const [bx, bz, r] of this.bunkers) if (Math.hypot(x - bx, z - bz) < r * 0.95) return 'sand';
    if (this.landSD(x, z) > -7) return h < 0.55 ? 'sand' : 'rough';
    return 'fairway';
  }
  // every gimmick spot, used to keep trees and swarms out of the way
  gimmickSpots() {
    return [
      ...this.webs.map(w => [w.x, w.z, 8]),
      ...this.belts.flatMap(b => [[b.p1.x, b.p1.z, 6], [b.p2.x, b.p2.z, 6]]),
      ...(this.hole.elephants || []).flatMap(([a, b, c, d]) => [[a, b, 10], [c, d, 10]]),
      ...this.snakes.map(s => [s.x, s.z, 8]),
      ...this.mountains.map(([x, z, r]) => [x, z, r + 2]),
      ...this.portals.map(p => [p.x, p.z, 6]),
      ...this.mysteries.map(m => [m.x, m.z, 6]),
    ];
  }

  // ---------- build ----------
  buildTerrain() {
    const step = 2;
    const W = this.maxX - this.minX, D = this.maxZ - this.minZ;
    const nx = Math.ceil(W / step), nz = Math.ceil(D / step);
    const geo = new THREE.PlaneGeometry(nx * step, nz * step, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate(this.minX + (nx * step) / 2, 0, this.minZ + (nz * step) / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), c2 = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      const s = this.surface(x, z, h);
      if (h < 0.02) {
        c.set(COLORS.shallow).lerp(c2.set(COLORS.deep), smooth(0, -2.5, h));
      } else if (s === 'fairway') {
        c.set(COLORS.fairway[Math.floor((z + x * 0.3) / 7) & 1]);
        c.lerp(c2.set(COLORS.rough), smooth(-12, -7, this.landSD(x, z)) * 0.5);
      } else if (s === 'green') {
        c.set(COLORS.green);
      } else if (s === 'sand') {
        c.set(h < 0.55 ? COLORS.beach : COLORS.sand);
      } else {
        c.set(COLORS.rough);
        c.offsetHSL(0, 0, (Math.sin(x * 0.7) * Math.cos(z * 0.6)) * 0.03);
      }
      if (h > 2.5 && s !== 'green') {
        const ny = this.normal(x, z).y;
        c.lerp(c2.set(COLORS.rock), smooth(0.93, 0.75, ny) * 0.85);
        if (h > 11) c.lerp(c2.set(COLORS.snow), smooth(11, 13, h));
      }
      const n = (this.rand() - 0.5) * 0.04;
      col[i * 3] = c.r * (1 + n); col[i * 3 + 1] = c.g * (1 + n); col[i * 3 + 2] = c.b * (1 + n);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(this.terrain);
  }

  buildCup() {
    const cup = M.makeCup();
    cup.group.position.copy(this.cup);
    this.group.add(cup.group);
    this.cupModel = cup;
    const tee = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    tee.rotation.x = -Math.PI / 2;
    tee.position.copy(this.tee).add(new THREE.Vector3(0, 0.05, 0));
    this.group.add(tee);
  }

  addWeb(x, z, a, big = false) {
    const size = big ? M.WEB_SIZE * 2 : M.WEB_SIZE;
    const m = M.makeWeb(size);
    const half = size / 2;
    // sit the web just above the highest ground under it
    let g = -Infinity;
    for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const lx = u * half, lz = v * half;
      g = Math.max(g, this.height(x + lx * Math.cos(a) + lz * Math.sin(a), z - lx * Math.sin(a) + lz * Math.cos(a)));
    }
    g = Math.max(g, 0.1);
    m.group.position.set(x, g, z);
    m.group.rotation.y = a;
    this.group.add(m.group);
    this.webs.push({ x, z, a, y: g + M.WEB_Y, half, big, model: m, wobble: 0, phase: this.rand() * 6 });
  }
  buildWebs() {
    this.webs = [];
    for (const [x, z, a, big] of this.hole.webs || []) this.addWeb(x, z, a, !!big);
  }

  buildBelts() {
    this.belts = (this.hole.belts || []).map(([x1, z1, x2, z2, w, web]) => {
      const p1 = new THREE.Vector3(x1, 0, z1), p2 = new THREE.Vector3(x2, 0, z2);
      const dir = p2.clone().sub(p1);
      const len = dir.length();
      dir.normalize();
      const perp = new THREE.Vector3(dir.z, 0, -dir.x);
      let top = -Infinity;
      for (let i = 0; i <= 8; i++) {
        const q = p1.clone().addScaledVector(dir, (len * i) / 8);
        top = Math.max(top, this.height(q.x, q.z));
      }
      top = Math.max(top, 0.2) + 0.6;
      const m = M.makeBelt(len, w);
      m.group.position.set(x1, top, z1);
      m.group.rotation.y = Math.atan2(dir.x, dir.z);
      for (let d = 2; d < len; d += 5) {
        const q = p1.clone().addScaledVector(dir, d);
        const post = M.makePost(top - this.height(q.x, q.z) + 1.5);
        post.position.set(0, -0.4, d);
        m.group.add(post);
      }
      this.group.add(m.group);
      if (web) this.addWeb(x2 + dir.x * 5, z2 + dir.z * 5, Math.atan2(dir.x, dir.z));
      return { p1, p2, dir, perp, len, w, top, model: m };
    });
  }

  // lily pads float on every lake
  buildPads() {
    this.pads = [];
    for (const [px, pz, rx, rz] of this.ponds) {
      const n = Math.max(1, Math.min(4, Math.round((rx * rz) / 45)));
      for (let i = 0; i < n; i++) {
        let x, z, ok = false;
        for (let t = 0; t < 30 && !ok; t++) {
          const a = this.rand() * 6.28, r = 0.2 + this.rand() * 0.45;
          x = px + Math.cos(a) * rx * r; z = pz + Math.sin(a) * rz * r;
          ok = this.height(x, z) < -0.6 && this.pads.every(p => Math.hypot(p.x - x, p.z - z) > 6);
        }
        if (!ok) continue;
        const m = M.makeLilyPad();
        m.group.position.set(x, 0.08, z);
        m.group.rotation.y = this.rand() * 6.28;
        this.group.add(m.group);
        this.pads.push({ x, z, r: 2.6, model: m, spin: 0, bob: this.rand() * 6 });
      }
    }
  }

  // whirlpool portals come in pairs: go in one, come out the other
  buildPortals() {
    const colors = [0x7c5cff, 0x00d0ff, 0xff6fd8, 0x4dff9a];
    this.portals = [];
    (this.hole.portals || []).forEach(([x1, z1, x2, z2], i) => {
      const a = { x: x1, z: z1 }, b = { x: x2, z: z2 };
      for (const p of [a, b]) {
        p.y = Math.max(0, this.height(p.x, p.z));
        p.model = M.makePortal(colors[i % colors.length]);
        p.model.group.position.set(p.x, p.y, p.z);
        this.group.add(p.model.group);
        this.portals.push(p);
      }
      a.to = b; b.to = a;
    });
  }

  buildMysteries() {
    this.mysteries = (this.hole.mystery || []).map(([x, z]) => {
      const m = M.makeMystery();
      const y = Math.max(0, this.height(x, z));
      m.group.position.set(x, y, z);
      this.group.add(m.group);
      return { x, z, y, model: m, used: false, t: 0, phase: this.rand() * 6 };
    });
  }

  buildElephants() {
    this.elephants = (this.hole.elephants || []).map(([x1, z1, x2, z2]) => {
      const m = M.makeElephant();
      const a = new THREE.Vector3(x1, 0, z1), b = new THREE.Vector3(x2, 0, z2);
      const el = { a, b, model: m, pos: a.clone(), t: this.rand(), dirSign: 1, yaw: 0, walk: 0,
        grabT: -1, rear: 0, rearTarget: 0, faceYaw: null, pause: 0 };
      this.group.add(m.group);
      this.placeElephant(el, 0);
      return el;
    });
  }

  placeElephant(el, dt) {
    const m = el.model;
    const time = performance.now() / 1000;
    if (el.grabT >= 0) {
      el.grabT += dt;
      const target = el.faceYaw ?? Math.atan2(this.cup.x - el.pos.x, this.cup.z - el.pos.z);
      let d = target - el.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      el.yaw += d * Math.min(1, dt * 5);
      const k = Math.min(1, el.grabT / 0.9);
      m.joints.forEach((j, i) => { j.rotation.x = lerp(-0.12, -0.5, k) - (i === 0 ? 0.3 * k : 0); j.rotation.z = 0; });
    } else {
      if (el.pause > 0) {
        el.pause -= dt;
      } else {
        const L = el.a.distanceTo(el.b);
        el.t += (dt * 1.3 * el.dirSign) / Math.max(1, L);
        if (el.t > 1 || el.t < 0) { el.t = Math.min(1, Math.max(0, el.t)); el.dirSign *= -1; el.pause = 1.5 + this.rand() * 2; }
        el.walk += dt * 4;
      }
      el.pos.lerpVectors(el.a, el.b, el.t);
      const target = el.pause > 0 ? el.yaw : Math.atan2((el.b.x - el.a.x) * el.dirSign, (el.b.z - el.a.z) * el.dirSign);
      let d = target - el.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      el.yaw += d * Math.min(1, dt * 2);
      m.joints.forEach((j, i) => { j.rotation.x = -0.12 + Math.sin(time * 1.6 - i * 0.5) * 0.06; j.rotation.z = Math.sin(time * 1.1 - i * 0.4) * 0.05; });
    }
    el.rear += (el.rearTarget - el.rear) * Math.min(1, dt * 4);
    m.rear.rotation.x = -0.6 * el.rear;
    const swing = el.pause > 0 || el.grabT >= 0 ? 0 : Math.sin(el.walk) * 0.25;
    m.legs.forEach((l, i) => { l.rotation.x = (i < 2 ? 0.5 * el.rear : 0) + (i === 0 || i === 3 ? 1 : -1) * swing; });
    el.pos.y = this.height(el.pos.x, el.pos.z);
    m.group.position.copy(el.pos);
    m.group.rotation.y = el.yaw;
  }

  buildSnakes() {
    this.snakes = (this.hole.snakes || []).map(([x, z]) => {
      const m = M.makeSnake();
      const y = this.height(x, z);
      m.group.position.set(x, y, z);
      this.group.add(m.group);
      return { x, z, y, model: m, phase: this.rand() * 10, up: 0, grab: false, shake: 0, faceYaw: this.rand() * 6 };
    });
  }

  buildTrees() {
    const geo = M.makePalmGeometry();
    const max = 140;
    const trunks = new THREE.InstancedMesh(geo.trunk, M.lam(0x9a6b3f), max);
    const crowns = new THREE.InstancedMesh(geo.crown, new THREE.MeshLambertMaterial({ vertexColors: true }), max);
    this.trees = [];
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const avoid = this.gimmickSpots();
    const groves = this.hole.groves || [];
    let tries = 0;
    while (this.trees.length < max && tries++ < 5000) {
      let x, z;
      const g = groves.length && this.rand() < 0.15 ? groves[Math.floor(this.rand() * groves.length)] : null;
      if (g) { const a = this.rand() * 6.28, r = Math.sqrt(this.rand()) * g[2]; x = g[0] + Math.cos(a) * r; z = g[1] + Math.sin(a) * r; }
      else { x = lerp(this.minX, this.maxX, this.rand()); z = lerp(this.minZ, this.maxZ, this.rand()); }
      const h = this.height(x, z);
      if (h < 0.7) continue;
      const sd = this.landSD(x, z);
      // the arena stays open: trees ring the shore, plus any groves
      if (!g && (sd < -14 || sd > -3)) continue;
      if (Math.hypot(x - this.cup.x, z - this.cup.z) < 18 || Math.hypot(x - this.tee.x, z - this.tee.z) < 10) continue;
      if (this.inLake(x, z) || this.surface(x, z, h) === 'green') continue;
      if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
      if (this.trees.some(t => Math.hypot(t.x - x, t.z - z) < 5.5)) continue;
      const s = 0.8 + this.rand() * 0.45, yaw = this.rand() * Math.PI * 2;
      q.setFromAxisAngle(up, yaw);
      mat.compose(new THREE.Vector3(x, h - 0.2, z), q, new THREE.Vector3(s, s, s));
      const i = this.trees.length;
      trunks.setMatrixAt(i, mat);
      crowns.setMatrixAt(i, mat);
      const top = new THREE.Vector3(M.PALM_LEAN, M.PALM_H, 0).applyMatrix4(mat);
      this.trees.push({ x, z, top: h + M.PALM_H * s, cx: top.x, cy: top.y, cz: top.z, cr: 2.8 * s });
    }
    trunks.count = crowns.count = this.trees.length;
    trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
    this.group.add(trunks, crowns);
  }

  addBubble(x, y, z, value, water = false) {
    const m = M.makeBubble(value);
    const base = new THREE.Vector3(x, y, z);
    m.group.position.copy(base);
    this.group.add(m.group);
    this.bubbles.push({ base, pos: base.clone(), value, model: m, r: m.radius, alive: true, phase: this.rand() * 6, pop: -1, water });
  }
  buildBubbles() {
    this.bubbles = [];
    // the higher a bubble floats, the harder it is to hit and the more it's worth
    const byAlt = (alt) => alt > 21.5 ? 300 : alt > 17 ? 100 : alt > 12 ? 50 : alt > 7.5 ? 30 : this.rand() < 0.5 ? 10 : 20;
    // scattered over the open ground
    const area = (this.maxX - this.minX) * (this.maxZ - this.minZ);
    const n = Math.round(area / 480);
    let tries = 0, made = 0;
    while (made < n && tries++ < n * 20) {
      const x = lerp(this.minX, this.maxX, this.rand()), z = lerp(this.minZ, this.maxZ, this.rand());
      const h = this.height(x, z);
      if (h < 0.3 || this.landSD(x, z) > -6) continue;
      const alt = 3 + Math.pow(this.rand(), 1.8) * 20;
      this.addBubble(x, h + alt, z, byAlt(alt));
      made++;
    }
    // big high rainbow bubbles
    for (let i = 0; i < 3; i++) {
      const p = this.pointAtS(this.total * (0.25 + 0.25 * i));
      this.addBubble(p.x + (this.rand() - 0.5) * 30, p.y + 18 + this.rand() * 5, p.z + (this.rand() - 0.5) * 10, 300);
    }
    // treasure on the mountain tops: land up there to grab it
    for (const [mx, mz, r, mh] of this.mountains) {
      const top = this.height(mx, mz);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        this.addBubble(mx + Math.cos(a) * r * 0.18, top + 1.4, mz + Math.sin(a) * r * 0.18, 300);
      }
      this.addBubble(mx, top + 6, mz, 100);
    }
    // bubbles sitting on the water for swimmers
    for (const [px, pz, rx, rz] of this.ponds) {
      const k = Math.max(2, Math.round((rx * rz) / 35));
      for (let i = 0; i < k; i++) {
        const a = this.rand() * 6.28, r = Math.sqrt(this.rand()) * 0.7;
        this.addBubble(px + Math.cos(a) * rx * r, 0.55, pz + Math.sin(a) * rz * r, this.rand() < 0.3 ? 30 : 20, true);
      }
    }
    for (const st of this.streams) {
      for (let s = 6; s < st.total - 3; s += 7) {
        const p = this.streamPoint(st, s);
        this.addBubble(p.x, 0.55, p.z, this.rand() < 0.25 ? 30 : 20, true);
      }
    }
    for (const [mx, mz, r1, r2] of this.moats) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3, r = (r1 + r2) / 2;
        this.addBubble(mx + Math.cos(a) * r, 0.55, mz + Math.sin(a) * r, i % 3 ? 20 : 30, true);
      }
    }
    for (const w of this.webs) this.addBubble(w.x, w.y + (w.big ? 16 : 9), w.z, w.big ? 300 : 50);
    for (const b of this.belts) {
      for (let d = 4; d < b.len - 2; d += 6) {
        const q = b.p1.clone().addScaledVector(b.dir, d);
        this.addBubble(q.x, b.top + 1.1, q.z, 20);
      }
    }
  }
  streamPoint(st, s) {
    let acc = 0;
    for (let i = 0; i < st.pts.length - 1; i++) {
      const a = st.pts[i], b = st.pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (s <= acc + L) { const k = (s - acc) / L; return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k) }; }
      acc += L;
    }
    return st.pts[st.pts.length - 1];
  }

  buildFlies() {
    // little swarms around the arena so a landing frog can chain them
    this.flies = [];
    const avoid = this.gimmickSpots();
    const swarms = Math.max(4, Math.round((this.maxX - this.minX) * (this.maxZ - this.minZ) / 5500));
    let tries = 0, made = 0;
    while (made < swarms && tries++ < 400) {
      const sx = lerp(this.minX, this.maxX, this.rand()), sz = lerp(this.minZ, this.maxZ, this.rand());
      const sh = this.height(sx, sz);
      if (sh < 0.5 || this.landSD(sx, sz) > -8 || avoid.some(([ax, az, r]) => Math.hypot(sx - ax, sz - az) < r)) continue;
      made++;
      const n = 2 + Math.floor(this.rand() * 3);
      for (let k = 0; k < n; k++) {
        const x = sx + (this.rand() - 0.5) * 12, z = sz + (this.rand() - 0.5) * 12;
        const h = this.height(x, z);
        if (h < 0.3) continue;
        const m = M.makeFly();
        const center = new THREE.Vector3(x, h + 1.8 + this.rand() * 2, z);
        this.group.add(m.group);
        this.flies.push({ center, pos: center.clone(), model: m, alive: true, targeted: false, phase: this.rand() * 6, r: 0.6 + this.rand() * 1.0 });
      }
    }
  }

  burst(pos, color, size = 4) {
    const s = M.makeBurst(color);
    s.position.copy(pos);
    this.group.add(s);
    this.bursts.push({ s, t: 0, size });
  }

  update(dt, time) {
    this.cupModel.diamond.rotation.y += dt * 1.5;
    this.cupModel.diamond.position.y = 9 + Math.sin(time * 2) * 0.4;
    for (const b of this.bubbles) {
      if (b.pop >= 0) {
        b.pop += dt;
        b.model.group.scale.setScalar(1 + b.pop * 4);
        b.model.shell.material.opacity = Math.max(0, 0.38 - b.pop * 1.6);
        if (b.pop > 0.25) { this.group.remove(b.model.group); b.pop = -2; }
        continue;
      }
      if (!b.alive) continue;
      b.pos.set(b.base.x, b.base.y + Math.sin(time * 1.4 + b.phase) * (b.water ? 0.12 : 0.35), b.base.z);
      b.model.group.position.copy(b.pos);
      b.model.halo.visible = !!b.hl;
      if (b.hl) b.model.halo.material.opacity = 0.55 + Math.sin(time * 8) * 0.3;
      b.model.group.scale.setScalar(b.hl ? 1.12 + Math.sin(time * 8) * 0.06 : 1);
    }
    for (const f of this.flies) {
      if (!f.alive) continue;
      const a = time * 1.7 + f.phase;
      if (f.targeted) { f.model.group.position.copy(f.pos); continue; }  // frozen while a frog leaps at it
      f.pos.set(f.center.x + Math.cos(a) * f.r, f.center.y + Math.sin(a * 2.3) * 0.4, f.center.z + Math.sin(a) * f.r);
      f.model.group.position.copy(f.pos);
      f.model.group.rotation.y = -a;
      const w = Math.sin(time * 60) * 0.7;
      f.model.wings[0].rotation.z = w; f.model.wings[1].rotation.z = -w;
    }
    for (const w of this.webs) {
      w.wobble = Math.max(0, w.wobble - dt * 1.5);
      w.model.web.position.y = M.WEB_Y - Math.sin(time * 18) * w.wobble * 0.25;
      const a = time * 0.4 + w.phase;
      w.model.spider.position.set(Math.cos(a) * 1.8, M.WEB_Y + 0.02, Math.sin(a * 1.3) * 1.8);
      w.model.spider.rotation.y = -a;
    }
    for (const sn of this.snakes) {
      // peek out for a couple of seconds, duck back down, repeat (always out while it has a frog)
      const cyc = (time * 0.35 + sn.phase) % 1;
      const want = sn.grab ? 1 : smooth(0, 0.12, cyc) * smooth(0.62, 0.5, cyc);
      sn.up += (want - sn.up) * Math.min(1, dt * (sn.grab ? 10 : 5));
      const m = sn.model;
      m.body.position.y = lerp(-5.7, 0, sn.up);
      m.body.visible = sn.up > 0.02;
      if (sn.grab) {
        sn.shake += dt;
        m.head.rotation.z = Math.sin(sn.shake * 28) * 0.5 * Math.min(1, sn.shake * 3);
      } else {
        m.head.rotation.z = Math.sin(time * 2 + sn.phase) * 0.12;
        sn.faceYaw += dt * 0.3;
      }
      m.body.rotation.y = sn.faceYaw;
      m.tongue.visible = Math.sin(time * 6 + sn.phase) > 0.3;
    }
    for (const b of this.belts) b.model.tex.offset.y -= dt * 7 / b.w;
    for (const p of this.pads) {
      p.spin = Math.max(0, p.spin - dt * 2);
      p.model.group.rotation.y += dt * (0.15 + p.spin * 9);
      p.model.group.position.y = 0.08 + Math.sin(time * 1.3 + p.bob) * 0.04;
    }
    for (const p of this.portals) p.model.disc.rotation.z -= dt * 3;
    for (const m of this.mysteries) {
      const mm = m.model;
      if (m.used) {
        m.t += dt;
        mm.glow.material.opacity = Math.max(0, 1 - m.t * 0.8);
        mm.balloon.position.y = 5 + m.t * 6;
        mm.string.visible = false;
        mm.group.children[0].material.opacity = Math.max(0, 1 - m.t);
        if (m.t > 2) mm.group.visible = false;
      } else {
        mm.balloon.position.y = 5 + Math.sin(time * 1.5 + m.phase) * 0.3;
        mm.balloon.rotation.y = Math.sin(time * 0.8 + m.phase) * 0.4;
      }
    }
    for (const el of this.elephants) this.placeElephant(el, dt);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const u = this.bursts[i];
      u.t += dt;
      u.s.scale.setScalar(u.size * (0.4 + u.t * 3));
      u.s.material.opacity = Math.max(0, 1 - u.t * 2.5);
      if (u.t > 0.4) { this.group.remove(u.s); this.bursts.splice(i, 1); }
    }
  }

  dispose() {
    this.terrain.geometry.dispose();
  }
}
