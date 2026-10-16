// One hole: terrain heightfield, surfaces, and every gimmick on it.
import * as THREE from 'three';
import * as M from './models.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUBBLE_VALUES = [10, 10, 20, 20, 30, 30, 50, 50, 100];
const COLORS = {
  fairway: [0x74d63f, 0x68c937], green: 0x93e85a, rough: 0x3f9e2e, sand: 0xf0dfa4,
  beach: 0xf3e3ae, shallow: 0xd8cf98, deep: 0x1f7a8a,
};

export class World {
  constructor(hole, index) {
    this.hole = hole;
    this.rand = mulberry32(1234 + index * 977);
    this.group = new THREE.Group();
    this.width = hole.width;
    this.path = hole.path.map(([x, z]) => ({ x, z }));
    this.seg = [];
    this.total = 0;
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i], b = this.path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      this.seg.push({ a, b, len, start: this.total });
      this.total += len;
    }
    this.bunkers = hole.bunkers || [];
    this.ponds = hole.ponds || [];
    this.moats = hole.moats || [];
    this.hills = hole.hills || [];
    const t = this.path[0], c = this.path[this.path.length - 1];
    this.teeH = this.rawHeight(t.x, t.z);
    this.greenH = this.rawHeight(c.x, c.z) + 0.1;
    this.tee = new THREE.Vector3(t.x, this.height(t.x, t.z), t.z);
    this.cup = new THREE.Vector3(c.x, this.height(c.x, c.z), c.z);
    // bounds
    const m = this.width + 45;
    this.minX = Math.min(...this.path.map(p => p.x)) - m;
    this.maxX = Math.max(...this.path.map(p => p.x)) + m;
    this.minZ = Math.min(...this.path.map(p => p.z)) - m;
    this.maxZ = Math.max(...this.path.map(p => p.z)) + m;

    this.buildTerrain();
    this.buildCup();
    this.buildWebs();
    this.buildBelts();
    this.buildElephants();
    this.buildTrees();
    this.buildBubbles();
    this.buildFlies();
    this.bursts = [];
  }

  // ---------- geometry queries ----------
  pathInfo(x, z) {
    let best = Infinity, s = 0;
    for (const g of this.seg) {
      const abx = g.b.x - g.a.x, abz = g.b.z - g.a.z;
      let t = ((x - g.a.x) * abx + (z - g.a.z) * abz) / (g.len * g.len);
      t = Math.min(1, Math.max(0, t));
      const dx = x - (g.a.x + abx * t), dz = z - (g.a.z + abz * t);
      const d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; s = g.start + t * g.len; }
    }
    return { d: Math.sqrt(best), s };
  }
  pointAtS(s) {
    s = Math.min(this.total, Math.max(0, s));
    for (const g of this.seg) {
      if (s <= g.start + g.len + 1e-6) {
        const t = (s - g.start) / g.len;
        const x = lerp(g.a.x, g.b.x, t), z = lerp(g.a.z, g.b.z, t);
        return new THREE.Vector3(x, this.height(x, z), z);
      }
    }
    return this.cup.clone();
  }
  islandR(s, x) { return this.width + 22 + 5 * Math.sin(s * 0.08 + x * 0.03); }
  rawHeight(x, z) {
    const p = this.pathInfo(x, z);
    let h = 1.4 + 0.7 * Math.sin(x * 0.06 + 1.3) * Math.cos(z * 0.045) + 0.35 * Math.sin(x * 0.15 + z * 0.12);
    for (const [hx, hz, r, hh] of this.hills) {
      const d2 = (x - hx) ** 2 + (z - hz) ** 2;
      h += hh * Math.exp(-d2 / (r * r));
    }
    h = Math.max(h, 0.8);                      // keep the island above the sea
    const R = this.islandR(p.s, x);
    const e = smooth(R - 6, R + 12, p.d);
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
    return h;
  }
  normal(x, z) {
    const e = 0.4;
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
  }
  inLake(x, z) {
    for (const [px, pz, rx, rz] of this.ponds) if (Math.hypot((x - px) / rx, (z - pz) / rz) < 1.4) return true;
    for (const [mx, mz, r1, r2] of this.moats) {
      const d = Math.hypot(x - mx, z - mz);
      if (d > r1 - 3 && d < r2 + 3) return true;
    }
    return false;
  }
  surface(x, z, h = this.height(x, z)) {
    if (h < 0.02) return this.inLake(x, z) ? 'pond' : 'sea';
    const c = this.cup;
    if (Math.hypot(x - c.x, z - c.z) < 11) return 'green';
    for (const [bx, bz, r] of this.bunkers) if (Math.hypot(x - bx, z - bz) < r * 0.95) return 'sand';
    const p = this.pathInfo(x, z);
    if (p.d < this.width) return 'fairway';
    if (h < 0.55) return 'sand';
    return 'rough';
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
        const p = this.pathInfo(x, z);
        c.set(COLORS.fairway[Math.floor(p.s / 7) % 2]);
        c.lerp(c2.set(COLORS.rough), smooth(this.width - 2, this.width + 1, p.d) * 0.5);
      } else if (s === 'green') {
        c.set(COLORS.green);
      } else if (s === 'sand') {
        c.set(h < 0.55 ? COLORS.beach : COLORS.sand);
      } else {
        c.set(COLORS.rough);
        c.offsetHSL(0, 0, (Math.sin(x * 0.7) * Math.cos(z * 0.6)) * 0.03);
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
    // tee box marker
    const tee = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    tee.rotation.x = -Math.PI / 2;
    tee.position.copy(this.tee).add(new THREE.Vector3(0, 0.05, 0));
    this.group.add(tee);
  }

  buildWebs() {
    this.webs = (this.hole.webs || []).map(([x, z, a]) => {
      const m = M.makeWeb();
      const y = this.height(x, z);
      m.group.position.set(x, y, z);
      m.group.rotation.y = a;
      this.group.add(m.group);
      return { x, z, a, y: y + M.WEB_Y, half: M.WEB_SIZE / 2, model: m, wobble: 0, phase: this.rand() * 6 };
    });
  }

  buildBelts() {
    this.belts = (this.hole.belts || []).map(([x1, z1, x2, z2, w]) => {
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
      return { p1, p2, dir, perp, len, w, top, model: m };
    });
  }

  buildElephants() {
    this.elephants = (this.hole.elephants || []).map(([x1, z1, x2, z2]) => {
      const m = M.makeElephant();
      m.group.scale.setScalar(1);
      const a = new THREE.Vector3(x1, 0, z1), b = new THREE.Vector3(x2, 0, z2);
      const el = { a, b, model: m, pos: a.clone(), t: this.rand(), dirSign: 1, yaw: 0, walk: 0, grabT: -1, cool: 0, pause: 0 };
      this.group.add(m.group);
      this.placeElephant(el, 0);
      return el;
    });
  }

  placeElephant(el, dt) {
    const m = el.model;
    if (el.grabT >= 0) {
      el.grabT += dt;
      const toCup = Math.atan2(this.cup.x - el.pos.x, this.cup.z - el.pos.z);
      let d = toCup - el.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      el.yaw += d * Math.min(1, dt * 5);
      const k = Math.min(1, el.grabT / 0.9);
      m.joints.forEach((j, i) => { j.rotation.x = lerp(-0.12, -0.5, k) - (i === 0 ? 0.3 * k : 0); });
    } else {
      el.cool = Math.max(0, el.cool - dt);
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
      const time = performance.now() / 1000;
      m.joints.forEach((j, i) => { j.rotation.x = -0.12 + Math.sin(time * 1.6 - i * 0.5) * 0.06; j.rotation.z = Math.sin(time * 1.1 - i * 0.4) * 0.05; });
    }
    const swing = el.pause > 0 || el.grabT >= 0 ? 0 : Math.sin(el.walk) * 0.25;
    m.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * swing; });
    el.pos.y = this.height(el.pos.x, el.pos.z);
    m.group.position.copy(el.pos);
    m.group.rotation.y = el.yaw;
  }

  buildTrees() {
    const geo = M.makePalmGeometry();
    const max = 110;
    const trunks = new THREE.InstancedMesh(geo.trunk, M.lam(0x9a6b3f), max);
    const crowns = new THREE.InstancedMesh(geo.crown, new THREE.MeshLambertMaterial({ vertexColors: true }), max);
    this.trees = [];
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const avoid = [...this.webs.map(w => [w.x, w.z, 7]), ...this.belts.flatMap(b => [[b.p1.x, b.p1.z, 6], [b.p2.x, b.p2.z, 6]]),
      ...(this.hole.elephants || []).flatMap(([a, b, c, d]) => [[a, b, 9], [c, d, 9]])];
    let tries = 0;
    while (this.trees.length < max && tries++ < 4000) {
      const x = lerp(this.minX, this.maxX, this.rand()), z = lerp(this.minZ, this.maxZ, this.rand());
      const h = this.height(x, z);
      if (h < 0.7) continue;
      const p = this.pathInfo(x, z);
      if (p.d < this.width + 3) continue;
      // denser near the fairway edge
      if (this.rand() > 1.15 - (p.d - this.width) / 30) continue;
      if (Math.hypot(x - this.cup.x, z - this.cup.z) < 18 || Math.hypot(x - this.tee.x, z - this.tee.z) < 10) continue;
      if (this.surface(x, z, h) !== 'rough') continue;
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

  buildBubbles() {
    this.bubbles = [];
    const add = (x, z, alt, value) => {
      const m = M.makeBubble(value);
      const base = new THREE.Vector3(x, this.height(x, z) + alt, z);
      m.group.position.copy(base);
      this.group.add(m.group);
      this.bubbles.push({ base, pos: base.clone(), value, model: m, r: m.radius, alive: true, phase: this.rand() * 6, pop: -1 });
    };
    for (let s = 14; s < this.total - 6; s += 7) {
      const n = this.rand() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const p = this.pointAtS(s + this.rand() * 5);
        const seg = this.seg.find(g => s <= g.start + g.len) || this.seg[this.seg.length - 1];
        const nx = -(seg.b.z - seg.a.z) / seg.len, nz = (seg.b.x - seg.a.x) / seg.len;
        const off = (this.rand() * 2 - 1) * this.width * 0.9;
        const v = BUBBLE_VALUES[Math.floor(this.rand() * BUBBLE_VALUES.length)];
        add(p.x + nx * off, p.z + nz * off, 3 + this.rand() * 12, v);
      }
    }
    // a couple of big, high rainbow bubbles
    for (let i = 0; i < 2; i++) {
      const p = this.pointAtS(this.total * (0.3 + 0.35 * i) + this.rand() * 10);
      add(p.x + (this.rand() - 0.5) * 8, p.z, 17 + this.rand() * 5, 300);
    }
    // bubbles riding above webs and belts reward the gimmicks
    for (const w of this.webs) add(w.x, w.z, 9, 100);
  }

  buildFlies() {
    // flies hang around in little swarms along the fairway so a landing frog can chain them
    this.flies = [];
    const swarms = Math.max(3, Math.round(this.total / 30));
    for (let i = 0; i < swarms; i++) {
      const p = this.pointAtS(this.total * (0.18 + 0.72 * ((i + this.rand() * 0.8) / swarms)));
      const sx = p.x + (this.rand() - 0.5) * this.width * 1.2, sz = p.z + (this.rand() - 0.5) * 8;
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
      b.pos.set(b.base.x, b.base.y + Math.sin(time * 1.4 + b.phase) * 0.35, b.base.z);
      b.model.group.position.copy(b.pos);
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
      w.model.web.position.y = M.WEB_Y - Math.sin(time * 18) * w.wobble * 0.5;
      const a = time * 0.4 + w.phase;
      w.model.spider.position.set(Math.cos(a) * 1.8, M.WEB_Y + 0.02, Math.sin(a * 1.3) * 1.8);
      w.model.spider.rotation.y = -a;
    }
    for (const b of this.belts) b.model.tex.offset.y -= dt * 7 / b.w;
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
