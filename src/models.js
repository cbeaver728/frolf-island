// Low-poly models built from primitives, plus a few canvas textures.
import * as THREE from 'three';

const SPH = new THREE.SphereGeometry(1, 18, 12);
const SPH_LO = new THREE.SphereGeometry(1, 10, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const matCache = new Map();
export function lam(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
function blob(geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- frog ----------
export function makeFrog(color) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
  g.add(blob(SPH, skin, 0.5, 0.36, 0.58, 0, 0.4, 0));
  g.add(blob(SPH, lam(0xfff1a8), 0.4, 0.25, 0.45, 0, 0.32, 0.1));
  for (const s of [-1, 1]) {
    g.add(blob(SPH, skin, 0.17, 0.17, 0.17, s * 0.22, 0.66, 0.26));
    g.add(blob(SPH, lam(0xffffff), 0.14, 0.14, 0.12, s * 0.23, 0.69, 0.34));
    g.add(blob(SPH_LO, lam(0x111111), 0.07, 0.08, 0.05, s * 0.24, 0.7, 0.45));
    g.add(blob(SPH_LO, lam(0xff8fa8), 0.07, 0.04, 0.04, s * 0.3, 0.46, 0.5));
    g.add(blob(SPH_LO, dark, 0.08, 0.14, 0.08, s * 0.27, 0.14, 0.36));
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 4, 12, Math.PI), lam(0x2a4a14));
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.5, 0.53);
  g.add(smile);
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.3, 0.32, -0.22);
    pivot.add(blob(SPH, dark, 0.16, 0.13, 0.3, s * 0.08, 0, 0.05));
    pivot.add(blob(SPH_LO, lam(0xf6d05a), 0.14, 0.05, 0.22, s * 0.12, -0.22, 0.18));
    g.add(pivot);
    legs.push(pivot);
  }
  return {
    group: g,
    setStretch(k) { for (const l of legs) l.rotation.x = k * 1.4; },
  };
}

// ---------- golfer: a kid in a frog hood with a big hammer ----------
export function makeGolfer() {
  const g = new THREE.Group();
  const hood = new THREE.MeshLambertMaterial({ color: 0x46c93a });
  const skinM = lam(0xffd2a8);
  for (const s of [-1, 1]) {
    g.add(blob(CYL, skinM, 0.08, 0.42, 0.08, s * 0.12, 0.25, 0));
    g.add(blob(SPH_LO, lam(0xffffff), 0.12, 0.08, 0.17, s * 0.12, 0.05, 0.04));
  }
  g.add(blob(CYL, lam(0x2f5fb0), 0.24, 0.24, 0.22, 0, 0.55, 0));
  g.add(blob(SPH, lam(0xffffff), 0.27, 0.28, 0.24, 0, 0.78, 0));
  g.add(blob(SPH, skinM, 0.34, 0.33, 0.33, 0, 1.22, 0.02));
  const hoodGeo = new THREE.SphereGeometry(0.4, 20, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.82);
  const h = new THREE.Mesh(hoodGeo, hood);
  h.position.set(0, 1.24, -0.02);
  g.add(h);
  for (const s of [-1, 1]) {
    g.add(blob(SPH, hood, 0.13, 0.13, 0.13, s * 0.17, 1.6, 0.06));
    g.add(blob(SPH_LO, lam(0xffffff), 0.09, 0.09, 0.07, s * 0.17, 1.63, 0.15));
    g.add(blob(SPH_LO, lam(0x111111), 0.045, 0.05, 0.03, s * 0.17, 1.64, 0.21));
    g.add(blob(SPH_LO, lam(0xffffff), 0.085, 0.1, 0.05, s * 0.12, 1.25, 0.32));
    g.add(blob(SPH_LO, lam(0x111111), 0.045, 0.055, 0.03, s * 0.12, 1.25, 0.36));
  }
  // hammer + arms swing together around the shoulders
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.9, 0.12);
  for (const s of [-1, 1]) {
    const arm = blob(CYL, lam(0xffffff), 0.07, 0.36, 0.07, s * 0.13, 0.15, 0);
    arm.rotation.z = -s * 0.25;
    pivot.add(arm);
  }
  pivot.add(blob(CYL, lam(0xc58a4a), 0.045, 1.0, 0.045, 0, 0.5, 0));
  const head = blob(CYL, lam(0xe8402f), 0.2, 0.55, 0.2, 0, 1.0, 0);
  head.rotation.z = Math.PI / 2;
  pivot.add(head);
  g.add(pivot);
  return {
    group: g,
    setColor(c) { hood.color.set(c); },
    setSwing(a) { pivot.rotation.x = a; },
  };
}

// ---------- seesaw launcher (+z is the shot direction) ----------
export function makeLauncher() {
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 3), lam(0xe8402f));
  block.rotation.z = Math.PI / 2;
  block.rotation.x = Math.PI / 6;
  block.position.y = 0.2;
  g.add(block);
  const arm = new THREE.Group();
  arm.position.y = 0.38;
  arm.add(blob(new THREE.BoxGeometry(1, 1, 1), lam(0xd9a066), 0.7, 0.1, 2.4));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.12, 12), lam(0xffd23f));
  cup.position.set(0, 0.08, 1.0);
  arm.add(cup);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), lam(0x2f5fb0));
  pad.position.set(0, 0.08, -1.0);
  arm.add(pad);
  g.add(arm);
  return { group: g, setTilt(a) { arm.rotation.x = a; } };
}

// ---------- palm tree geometry (shared by instanced meshes) ----------
function merge(parts) {
  const pos = [], nor = [], col = [];
  const c = new THREE.Color();
  for (const { geo, matrix, color } of parts) {
    const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    pos.push(...gg.attributes.position.array);
    nor.push(...gg.attributes.normal.array);
    c.set(color);
    for (let i = 0; i < gg.attributes.position.count; i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
export const PALM_H = 8, PALM_LEAN = 1.1;
export function makePalmGeometry() {
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, PALM_H, 7, 6);
  trunk.translate(0, PALM_H / 2, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / PALM_H;
    p.setX(i, p.getX(i) + PALM_LEAN * y * y);
    if (Math.round(p.getY(i) * 3) % 2 === 0) p.setX(i, p.getX(i) * 1.05);
  }
  trunk.computeVertexNormals();
  const parts = [];
  const box = new THREE.BoxGeometry(0.9, 0.08, 2.4);
  box.translate(0, 0, 1.2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
    const green = i % 2 ? 0x2f9e3a : 0x3fb847;
    e.set(-0.25, yaw, 0, 'YXZ');
    m.compose(new THREE.Vector3(PALM_LEAN, PALM_H, 0), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    parts.push({ geo: box, matrix: m.clone(), color: green });
    // outer, drooping half of the frond
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const tip = new THREE.Vector3(PALM_LEAN, PALM_H, 0).addScaledVector(dir, 2.3).add(new THREE.Vector3(0, 0.58, 0));
    e.set(0.55, yaw, 0, 'YXZ');
    m.compose(tip, q.setFromEuler(e), new THREE.Vector3(0.8, 1, 1));
    parts.push({ geo: box, matrix: m.clone(), color: green });
  }
  const nut = new THREE.SphereGeometry(0.25, 6, 5);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    m.makeTranslation(PALM_LEAN + Math.sin(a) * 0.3, PALM_H - 0.3, Math.cos(a) * 0.3);
    parts.push({ geo: nut, matrix: m.clone(), color: 0xc9a227 });
  }
  return { trunk, crown: merge(parts) };
}

// ---------- elephant (+z forward) ----------
export function makeElephant() {
  const g = new THREE.Group();
  const skin = lam(0xc49a86), dark = lam(0x9c7666), ivory = lam(0xfff6e4);
  g.add(blob(SPH, skin, 2.1, 1.9, 2.9, 0, 3.6, 0));
  g.add(blob(SPH, dark, 1.7, 1.3, 1.9, 0, 4.8, 0.6));
  g.add(blob(SPH, skin, 1.45, 1.5, 1.4, 0, 4.6, 2.9));
  g.add(blob(SPH, dark, 0.9, 0.6, 0.9, 0, 5.9, 2.7));
  for (const s of [-1, 1]) {
    g.add(blob(SPH, dark, 0.3, 1.1, 0.9, s * 1.35, 4.5, 2.4));
    g.add(blob(SPH_LO, lam(0xffffff), 0.32, 0.36, 0.2, s * 0.68, 5.0, 4.0));
    g.add(blob(SPH_LO, lam(0x111111), 0.16, 0.2, 0.1, s * 0.72, 5.0, 4.17));
    const tusk = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.14, 6, 12, Math.PI * 0.85), ivory);
    tusk.rotation.y = -Math.PI / 2;
    tusk.rotation.x = Math.PI;
    tusk.position.set(s * 0.7, 4.0, 3.5);
    g.add(tusk);
  }
  const legs = [];
  for (const [x, z] of [[-1.1, 1.5], [1.1, 1.5], [-1.1, -1.5], [1.1, -1.5]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.7, z);
    pivot.add(blob(CYL, skin, 0.62, 2.7, 0.62, 0, -1.35, 0));
    pivot.add(blob(CYL, ivory, 0.66, 0.2, 0.66, 0, -2.6, 0));
    g.add(pivot);
    legs.push(pivot);
  }
  const tail = blob(CYL, dark, 0.1, 1.2, 0.1, 0, 3.4, -2.95);
  tail.rotation.x = 0.4;
  g.add(tail);
  const joints = [];
  let parent = new THREE.Group();
  parent.position.set(0, 4.25, 3.95);
  g.add(parent);
  for (let i = 0; i < 7; i++) {
    const j = i === 0 ? parent : new THREE.Group();
    if (i > 0) { j.position.y = -0.6; parent.add(j); }
    const r = 0.44 - i * 0.035;
    j.add(blob(CYL, skin, r, 0.66, r, 0, -0.3, 0));
    joints.push(j);
    parent = j;
  }
  const tip = new THREE.Object3D();
  tip.position.y = -0.7;
  parent.add(tip);
  // everything hangs off a pivot at the back legs so the elephant can rear up
  const rear = new THREE.Group();
  rear.position.z = -1.5;
  const inner = new THREE.Group();
  inner.position.z = 1.5;
  while (g.children.length) inner.add(g.children[0]);
  rear.add(inner);
  g.add(rear);
  return { group: g, legs, joints, tip, rear };
}

// ---------- spider web trampoline, stretched just above the ground ----------
let webTex = null;
export const WEB_SIZE = 7, WEB_Y = 0.35;
export function makeWeb(size = WEB_SIZE) {
  if (!webTex) {
    webTex = canvasTex(256, 256, (c, w) => {
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.lineWidth = 3;
      c.strokeRect(4, 4, w - 8, w - 8);
      const cx = w / 2;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        c.beginPath(); c.moveTo(cx, cx); c.lineTo(cx + Math.cos(a) * w, cx + Math.sin(a) * w); c.stroke();
      }
      c.lineWidth = 2.2;
      for (let r = 14; r < w * 0.7; r += 14) {
        c.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rr = r * (1 + 0.06 * Math.sin(i * 1.7));
          const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
    });
  }
  const g = new THREE.Group();
  const s = size / 2;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    g.add(blob(CYL, lam(0x8a5a2b), 0.16, 2.6, 0.16, x, WEB_Y + 0.25 - 1.3, z));
    g.add(blob(SPH_LO, lam(0xffd23f), 0.26, 0.26, 0.26, x, WEB_Y + 0.3, z));
  }
  const web = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: webTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  web.rotation.x = -Math.PI / 2;
  web.position.y = WEB_Y;
  g.add(web);
  const spider = new THREE.Group();
  spider.add(blob(SPH, lam(0x2a1f3d), 0.38, 0.3, 0.45, 0, 0.25, 0));
  spider.add(blob(SPH_LO, lam(0xb03a8c), 0.22, 0.2, 0.22, 0, 0.32, 0.4));
  for (const sx of [-1, 1]) {
    spider.add(blob(SPH_LO, lam(0xffffff), 0.08, 0.08, 0.06, sx * 0.1, 0.42, 0.58));
    for (let i = 0; i < 4; i++) {
      const leg = blob(CYL, lam(0x2a1f3d), 0.035, 0.7, 0.035, sx * 0.4, 0.2, -0.25 + i * 0.18);
      leg.rotation.z = sx * 1.1;
      spider.add(leg);
    }
  }
  spider.position.y = WEB_Y;
  spider.scale.setScalar(size / WEB_SIZE);
  g.add(spider);
  return { group: g, spider, web };
}

// ---------- snake: a big round head that pops in and out of a hole ----------
export function makeSnake() {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), new THREE.MeshBasicMaterial({ color: 0x2b1a0e }));
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06;
  g.add(hole);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.22, 6, 20), lam(0x7a5230));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.08;
  g.add(rim);
  const body = new THREE.Group();
  g.add(body);
  const green = lam(0x3fae49), belly = lam(0xf2e05a);
  for (let i = 0; i < 6; i++) {
    const r = 0.62 - i * 0.03;
    body.add(blob(SPH, i % 2 ? belly : green, r, 0.45, r, 0, 0.3 + i * 0.6, 0));
  }
  const head = new THREE.Group();
  head.position.y = 4.1;
  body.add(head);
  head.add(blob(SPH, green, 1.25, 1.15, 1.2));
  head.add(blob(SPH, belly, 0.9, 0.5, 0.7, 0, -0.55, 0.55));
  for (const sx of [-1, 1]) {
    head.add(blob(SPH_LO, lam(0xffffff), 0.36, 0.4, 0.25, sx * 0.48, 0.4, 0.95));
    head.add(blob(SPH_LO, lam(0x111111), 0.15, 0.25, 0.1, sx * 0.5, 0.42, 1.17));
    head.add(blob(SPH_LO, green, 0.4, 0.15, 0.3, sx * 0.48, 0.82, 0.88));
  }
  const mouth = blob(SPH_LO, lam(0x5a0f1f), 0.55, 0.16, 0.2, 0, -0.2, 1.1);
  head.add(mouth);
  const tongue = blob(CYL, lam(0xff3355), 0.05, 0.6, 0.05, 0, -0.25, 1.45);
  tongue.rotation.x = Math.PI / 2;
  head.add(tongue);
  const grip = new THREE.Object3D();
  grip.position.set(0, -0.5, 1.5);
  head.add(grip);
  return { group: g, body, head, grip, tongue };
}

// ---------- conveyor belt: origin at the start, +z toward the end, y=0 is the belt top ----------
let beltTexSrc = null;
export function makeBelt(len, width) {
  if (!beltTexSrc) {
    beltTexSrc = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#3a3f4a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(8, 44); c.lineTo(32, 18); c.lineTo(56, 44); c.lineTo(46, 44); c.lineTo(32, 30); c.lineTo(18, 44); c.fill();
    });
  }
  const tex = beltTexSrc.clone();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, len / width);
  tex.needsUpdate = true;
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  g.add(blob(box, lam(0x6b7280), width + 0.5, 0.45, len, 0, -0.26, len / 2));
  for (const s of [-1, 1]) g.add(blob(box, lam(0xffb52e), 0.25, 0.4, len, s * (width / 2 + 0.25), 0.05, len / 2));
  for (const z of [0, len]) {
    const r = blob(CYL, lam(0x9ca3af), 0.32, width, 0.32, 0, -0.3, z);
    r.rotation.z = Math.PI / 2;
    g.add(r);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(width, len), new THREE.MeshLambertMaterial({ map: tex }));
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = Math.PI;
  top.position.set(0, 0.01, len / 2);
  g.add(top);
  return { group: g, tex };
}
export function makePost(height) {
  return blob(CYL, lam(0x4b5563), 0.18, height, 0.18, 0, -height / 2, 0);
}

// ---------- light column, used for the cup and the aim reticle ----------
let columnTex = null;
function getColumnTex() {
  if (!columnTex) {
    columnTex = canvasTex(4, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0.9)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
  }
  return columnTex;
}
function column(radius, height, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20, 1, true),
    new THREE.MeshBasicMaterial({ map: getColumnTex(), color, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  m.position.y = height / 2;
  return m;
}

export function makeCup() {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color: 0x0b1a0b }));
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.04;
  g.add(hole);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.3, 24), lam(0xffffff));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  g.add(ring);
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.3, 4.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x9dff6a, transparent: true, opacity: 0.35, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06;
  g.add(glow);
  g.add(column(1.1, 26, 0x55ff77));
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x88ccff, emissiveIntensity: 0.5, shininess: 120, flatShading: true }));
  diamond.scale.y = 1.35;
  diamond.position.y = 9;
  g.add(diamond);
  return { group: g, diamond };
}

export function makeReticle() {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.95, 32), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; ring.renderOrder = 5;
  g.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: 0xff4d6d, depthTest: false }));
  dot.rotation.x = -Math.PI / 2; dot.position.y = 0.16; dot.renderOrder = 6;
  g.add(dot);
  const col = column(1.6, 14, 0xffe066);
  g.add(col);
  return { group: g, ringMat, col };
}

// ---------- bubbles, flies, shadows ----------
const BUBBLE_COLORS = { 10: 0x9ad8ff, 20: 0x9ad8ff, 30: 0x8dffb0, 50: 0xfff08a, 100: 0xffa8e8, 300: 0xff7a7a };
const textTex = new Map();
function numberTex(text, color) {
  const key = text + color;
  if (!textTex.has(key)) {
    textTex.set(key, canvasTex(128, 64, (c, w, h) => {
      c.font = 'bold 40px "Baloo 2", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 8; c.strokeStyle = 'rgba(20,40,80,0.85)';
      c.strokeText(text, w / 2, h / 2 + 2);
      c.fillStyle = color; c.fillText(text, w / 2, h / 2 + 2);
    }));
  }
  return textTex.get(key);
}
const BUBBLE_GEO = new THREE.SphereGeometry(1, 20, 14);
export function makeBubble(value) {
  const g = new THREE.Group();
  // halo used when the bubble sits on the aimed path
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: 0xffe14d, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.visible = false;
  g.add(halo);
  const r = { 10: 0.9, 20: 1.0, 30: 1.1, 50: 1.3, 100: 1.75, 300: 2.5 }[value] || 1;
  const shell = new THREE.Mesh(BUBBLE_GEO, new THREE.MeshPhongMaterial({
    color: BUBBLE_COLORS[value] || 0x9ad8ff, transparent: true, opacity: 0.38, shininess: 140,
    specular: 0xffffff, depthWrite: false }));
  shell.scale.setScalar(r);
  g.add(shell);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTex('+' + value, '#ffffff'), depthWrite: false }));
  label.scale.set(1.9 * r, 0.95 * r, 1);
  g.add(label);
  halo.scale.setScalar(r * 3.6);
  return { group: g, radius: r, shell, halo };
}

export function makeFly() {
  const g = new THREE.Group();
  g.add(blob(SPH_LO, lam(0x222222), 0.18, 0.15, 0.26));
  g.add(blob(SPH_LO, lam(0xff3b3b), 0.08, 0.08, 0.08, 0.08, 0.06, 0.2));
  g.add(blob(SPH_LO, lam(0xff3b3b), 0.08, 0.08, 0.08, -0.08, 0.06, 0.2));
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.18), wingMat);
    w.position.set(s * 0.2, 0.12, 0);
    g.add(w);
    wings.push(w);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: 0xfff07a, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(1.6, 1.6, 1);
  g.add(glow);
  return { group: g, wings };
}

let glowTex = null;
function getGlowTex() {
  if (!glowTex) {
    glowTex = canvasTex(64, 64, (c, w) => {
      const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, w);
    });
  }
  return glowTex;
}

export function makeShadow() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20),
    new THREE.MeshBasicMaterial({ map: getGlowTex(), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

export function makeBurst(color) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  return m;
}

// ---------- sky, sea, clouds ----------
export function makeSky() {
  const geo = new THREE.SphereGeometry(1000, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f8cf0) }, mid: { value: new THREE.Color(0x8fd0ff) }, low: { value: new THREE.Color(0xe4f7ff) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(low, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  return new THREE.Mesh(geo, mat);
}

export function makeSea() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshPhongMaterial({ color: 0x27b0e6, transparent: true, opacity: 0.8, shininess: 90, specular: 0x9fe8ff, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

export function makeClouds() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xbfd8ee, fog: false });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const d = 420 + Math.random() * 180;
    c.position.set(Math.cos(a) * d, 70 + Math.random() * 70, Math.sin(a) * d);
    const n = 4 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const s = 14 + Math.random() * 16;
      c.add(blob(SPH_LO, mat, s * 1.4, s * 0.8, s, (k - n / 2) * 18, Math.random() * 6, Math.random() * 10));
    }
    c.lookAt(0, c.position.y, 0);
    g.add(c);
  }
  return g;
}

// ---------- lily pad: spins with the frog on it, then flings it ----------
export function makeLilyPad(r = 2.4) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 28, 1, false, 0.35, Math.PI * 2 - 0.7), lam(0x67c23a));
  g.add(pad);
  const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 28, 0.35, Math.PI * 2 - 0.7), lam(0x8fdb4f));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.1;
  g.add(top);
  for (let i = 0; i < 6; i++) {
    const vein = blob(new THREE.BoxGeometry(1, 1, 1), lam(0x5aa833), r * 0.85, 0.02, 0.06, 0, 0.11, 0);
    vein.rotation.y = 0.5 + (i / 6) * (Math.PI * 2 - 1);
    vein.position.set(Math.cos(vein.rotation.y) * r * 0.42, 0.11, -Math.sin(vein.rotation.y) * r * 0.42);
    g.add(vein);
  }
  const flower = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const p = blob(SPH_LO, lam(0xff9ccd), 0.16, 0.06, 0.32, Math.sin(i) * 0.2, 0.2, Math.cos(i) * 0.2);
    p.rotation.y = i;
    flower.add(p);
  }
  flower.add(blob(SPH_LO, lam(0xffe14d), 0.12, 0.08, 0.12, 0, 0.25, 0));
  flower.position.set(-r * 0.55, 0, r * 0.3);
  g.add(flower);
  return { group: g };
}

// ---------- whirlpool portal ----------
let swirlTex = null;
export function makePortal(color) {
  if (!swirlTex) {
    swirlTex = canvasTex(256, 256, (c, w) => {
      const cx = w / 2;
      const gr = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
      gr.addColorStop(0, 'rgba(10,20,60,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, w);
      c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineCap = 'round';
      for (let arm = 0; arm < 4; arm++) {
        c.lineWidth = 9;
        c.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
          const a = arm * Math.PI / 2 + t * 5, r = 8 + t * (cx - 14);
          const x = cx + Math.cos(a) * r, y = cx + Math.sin(a) * r;
          t ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
    });
  }
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshBasicMaterial({ map: swirlTex, color, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.18, 6, 32), new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
  g.add(ring);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(7, 3, 1); glow.position.y = 0.8;
  g.add(glow);
  return { group: g, disc };
}

// ---------- mystery circle: a "?" pad with a balloon tied above it ----------
let qTex = null;
export function makeMystery() {
  if (!qTex) {
    qTex = canvasTex(128, 128, (c, w) => {
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2); c.fill();
      c.lineWidth = 8; c.strokeStyle = '#ff4f7b'; c.stroke();
      c.fillStyle = '#ff4f7b'; c.font = 'bold 90px "Baloo 2", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, w / 2 + 6);
    });
  }
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ map: qTex, transparent: true }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.08;
  g.add(pad);
  const balloon = new THREE.Group();
  const bMat = new THREE.MeshPhongMaterial({ color: 0xff4f7b, shininess: 90, emissive: 0x000000 });
  balloon.add(blob(SPH, bMat, 0.9, 1.1, 0.9, 0, 0, 0));
  balloon.add(blob(SPH_LO, bMat, 0.18, 0.18, 0.18, 0, -1.1, 0));
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex, depthWrite: false }));
  label.scale.set(1.1, 1.1, 1); label.position.set(0, 0.1, 0.95);
  balloon.add(label);
  balloon.position.y = 5;
  g.add(balloon);
  const string = blob(CYL, lam(0xffffff), 0.02, 4, 0.02, 0, 2, 0);
  g.add(string);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: 0xffe14d, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  glow.scale.set(9, 9, 1); glow.position.y = 1;
  g.add(glow);
  return { group: g, balloon, string, glow, bMat };
}
