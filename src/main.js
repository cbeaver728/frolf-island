import * as THREE from 'three';
import { HOLES } from './holes.js';
import { World } from './world.js';
import * as M from './models.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

// ---------- tuning ----------
const G = 22;                 // gravity, m/s²
const VMAX = 43.5;            // launch speed at full power (≈85 m carry on MID)
const CUP_R = 1.0;
const MAX_STROKES = 8;
const LOFTS = [{ name: 'LOW', deg: 26 }, { name: 'MID', deg: 42 }, { name: 'HIGH', deg: 58 }];
const PLAYER_DEFS = [
  { name: 'Green', color: 0x46c93a, css: '#46c93a' },
  { name: 'Blue', color: 0x3d9cf0, css: '#3d9cf0' },
  { name: 'Pink', color: 0xff6fae, css: '#ff6fae' },
  { name: 'Gold', color: 0xffb52e, css: '#ffb52e' },
];
const HOLE_BONUS = [0, 3000, 1500, 1000, 700, 500, 400, 300, 200];
const HOP_SPEED = { fairway: 4.4, green: 3.2, rough: 2.4 };
const HOP_COUNT = { fairway: 2, green: 2, rough: 1, sand: 0 };
const BOUNCE = { fairway: [0.22, 0.42], green: [0.15, 0.3], rough: [0.12, 0.3] };
const HOP_VY = 5.2;

// ---------- renderer / scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd6f1ff, 150, 560);
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2500);
scene.add(M.makeSky());
const sea = M.makeSea();
scene.add(sea);
scene.add(M.makeClouds());
scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x5c8a3c, 1.5));
const sun = new THREE.DirectionalLight(0xfff4dd, 1.9);
sun.position.set(60, 100, 40);
scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// shared actors
const golfer = M.makeGolfer();
const launcher = M.makeLauncher();
const rig = new THREE.Group();
rig.add(launcher.group);
golfer.group.position.set(0, 0, -2.05);
rig.add(golfer.group);
scene.add(rig);
const reticle = M.makeReticle();
scene.add(reticle.group);
const ARC_N = 28;
const arcDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), ARC_N);
arcDots.frustumCulled = false;
scene.add(arcDots);
// dotted circle showing how far the frog can reach with the current angle
const RING_N = 160;
const rangeRing = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8 }), RING_N);
rangeRing.frustumCulled = false;
rangeRing.visible = false;
scene.add(rangeRing);

// ---------- state ----------
const setup = { slots: ['you', 'cpu', 'off', 'off'], holes: 6 };
let best = 0;
try { best = Number(localStorage.getItem('frolf.best')) || 0; } catch { /* storage blocked */ }

let world = null, players = [], holeList = [], holeIdx = 0, cur = null;
let phase = 'title', phaseT = 0, time = 0;
let aimYaw = 0, mapMode = false, meterPh = 0, power = 0, cpuPlan = null, swingFired = false;
// the target: a heading plus a distance, and the power that lands the frog exactly there
let aimDist = 30, aimPower = 1, aimMax = 85, meterSpeed = 1;
const aimLand = new THREE.Vector3();
let shot = null, firstIn = false;
const camPos = new THREE.Vector3(0, 40, 60), camLook = new THREE.Vector3();
const camPosT = new THREE.Vector3(), camLookT = new THREE.Vector3();
const chaseDir = new THREE.Vector3(0, 0, -1);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

const short = (v) => (v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(v));
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const dirOf = (yaw) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// ---------- physics helpers ----------
function launchVel(yaw, deg, p) {
  const s = VMAX * Math.sqrt(0.05 + 0.95 * p);
  const a = (deg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(a) * s, Math.sin(a) * s, Math.cos(yaw) * Math.cos(a) * s);
}
function seatPos(rest, yaw) {
  return new THREE.Vector3(rest.x + Math.sin(yaw) * 1.0, rest.y + 0.2, rest.z + Math.cos(yaw) * 1.0);
}
// ballistic preview ignoring gimmicks; fills `pts` with points along the arc
function predict(start, vel, pts) {
  const p = start.clone(), v = vel.clone();
  const dt = 1 / 60;
  for (let i = 0; i < 900; i++) {
    v.y -= G * dt;
    p.addScaledVector(v, dt);
    if (pts && i % 4 === 0) pts.push(p.clone());
    const h = world.height(p.x, p.z);
    if (v.y < 0 && p.y <= Math.max(h, 0)) { p.y = Math.max(h, 0); return p; }
  }
  return p;
}
function maxRange(loft = 1) { return (VMAX * VMAX * Math.sin((2 * LOFTS[loft].deg * Math.PI) / 180)) / G; }

// power (0..1) whose first landing is `d` metres out along `yaw`
function solvePower(from, yaw, deg, d) {
  let lo = 0, hi = 1;
  const start = seatPos(from, yaw);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (hdist(predict(start, launchVel(yaw, deg, mid)), from) < d) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// re-solve the shot after the target moves; clamps the target to what the frog can reach
const arcPts = [];
function updateAim() {
  const deg = LOFTS[cur.loft].deg;
  const start = seatPos(cur.pos, aimYaw);
  aimMax = hdist(predict(start, launchVel(aimYaw, deg, 1)), cur.pos);
  aimDist = Math.min(Math.max(aimDist, 3), aimMax);
  aimPower = aimDist >= aimMax - 0.01 ? 1 : solvePower(cur.pos, aimYaw, deg, aimDist);
  arcPts.length = 0;
  aimLand.copy(predict(start, launchVel(aimYaw, deg, aimPower), arcPts));
  // longer shots make the power bar run faster
  meterSpeed = lerp(0.55, 1.45, Math.min(1, aimDist / maxRange(1)));
  placeRig();
}
function setAimPoint(pt) {
  if (hdist(pt, cur.pos) < 2) return;
  aimYaw = yawTo(cur.pos, pt);
  aimDist = hdist(pt, cur.pos);
  updateAim();
}

// where a sensible shot from `from` should go: the cup if reachable, else further down the fairway
function autoTarget(from) {
  const R = maxRange() * 0.9;
  if (hdist(from, world.cup) <= R) return world.cup.clone();
  const info = world.pathInfo(from.x, from.z);
  let s = info.s + R * 0.85;
  let t = world.pointAtS(s);
  while (hdist(from, t) > R && s > info.s + 5) { s -= 4; t = world.pointAtS(s); }
  return t;
}

// ---------- HUD ----------
function updateBoard() {
  $('board').innerHTML = players.map(p => `
    <div class="row${p === cur ? ' cur' : ''}${p.holed ? ' done' : ''}">
      <i style="background:${p.def.css}"></i><span>${p.def.name}${p.cpu ? ' <small>CPU</small>' : ''}</span>
      <b>${p.total.toLocaleString()}</b><em>${p.holed ? '✓' : p.strokes}</em>
    </div>`).join('');
}
function updatePin() {
  if (!cur || !world) return;
  $('pin').textContent = `PIN ${Math.round(hdist(cur.pos, world.cup))}m`;
}
let bannerTimer = 0;
function banner(text, cls = '', dur = 1.6) {
  const b = $('banner');
  b.textContent = text;
  b.className = 'show ' + cls;
  bannerTimer = dur;
}
const popups = [];
function popup(text, pos, cls = '') {
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.innerHTML = text;
  $('popups').appendChild(el);
  popups.push({ el, pos: pos.clone(), t: 0 });
}
function setControls(mode) {
  // mode: 'aim' | 'meter' | 'hidden' | 'watch'
  const bottom = $('bottom');
  bottom.dataset.mode = mode;
  $('loftBtn').textContent = LOFTS[cur ? cur.loft : 1].name;
  $('swingBtn').textContent = mode === 'meter' ? 'HIT!' : 'SWING';
  $('mapBtn').classList.toggle('on', mapMode);
}
function setMeter(m) {
  $('meterFill').style.width = `${(m * 100).toFixed(1)}%`;
  $('meterWrap').classList.toggle('hot', m >= 0.97);
  if (cur) $('meterRange').textContent = `TARGET ${aimDist.toFixed(0)}m`;
}

// ---------- title / setup ----------
function renderSetup() {
  $('slots').innerHTML = setup.slots.map((s, i) => `
    <button class="slot ${s}" data-i="${i}">
      <i style="background:${PLAYER_DEFS[i].css}"></i>${PLAYER_DEFS[i].name}
      <b>${s === 'you' ? 'Player' : s === 'cpu' ? 'CPU' : '—'}</b>
    </button>`).join('');
  $('holesBtn').textContent = `${setup.holes} holes`;
  $('best').textContent = best ? `Best score: ${best.toLocaleString()}` : 'Launch frogs, pop bubbles, sink it!';
}
$('slots').addEventListener('click', (e) => {
  const b = e.target.closest('.slot');
  if (!b) return;
  const i = Number(b.dataset.i);
  const order = i === 0 ? ['you', 'cpu'] : ['off', 'you', 'cpu'];
  setup.slots[i] = order[(order.indexOf(setup.slots[i]) + 1) % order.length];
  renderSetup();
});
$('holesBtn').addEventListener('click', () => { setup.holes = setup.holes === 6 ? 3 : 6; renderSetup(); });
$('playBtn').addEventListener('click', () => { unlockAudio(); sfx.croak(); startGame(); });
renderSetup();

function startGame() {
  players.forEach(p => { scene.remove(p.frog.group, p.shadow); });
  players = setup.slots.map((s, i) => s === 'off' ? null : {
    def: PLAYER_DEFS[i], cpu: s === 'cpu', total: 0, holes: [], loft: 1,
    frog: M.makeFrog(PLAYER_DEFS[i].color), shadow: M.makeShadow(), pos: new THREE.Vector3(), strokes: 0, holed: false, holePts: 0,
  }).filter(Boolean);
  players.forEach(p => scene.add(p.frog.group, p.shadow));
  holeList = HOLES.slice(0, setup.holes);
  holeIdx = 0;
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  loadHole();
}

function loadHole() {
  if (world) { scene.remove(world.group); world.dispose(); }
  const h = holeList[holeIdx];
  world = new World(h, HOLES.indexOf(h));
  scene.add(world.group);
  players.forEach((p, i) => {
    p.pos.copy(world.tee);
    p.strokes = 0; p.holed = false; p.holePts = 0; p.picked = false;
    p.frog.group.visible = false;
    p.frog.group.scale.setScalar(1);
    p.shadow.visible = false;
  });
  firstIn = false;
  cur = null;
  $('holeNum').textContent = `HOLE ${holeIdx + 1}`;
  $('holeName').textContent = h.name;
  $('pin').textContent = `${Math.round(world.total)}m`;
  updateBoard();
  phase = 'intro'; phaseT = 0;
  rig.visible = false;
  reticle.group.visible = false; arcDots.visible = false; rangeRing.visible = false;
  setControls('hidden');
  banner(`Hole ${holeIdx + 1} · ${h.name}`, 'big', 3);
}

function nextTurn() {
  const left = players.filter(p => !p.holed);
  if (!left.length) return endHole();
  left.sort((a, b) => a.strokes - b.strokes || hdist(b.pos, world.cup) - hdist(a.pos, world.cup));
  const prev = cur;
  cur = left[0];
  beginAim();
  if (players.length > 1 && cur !== prev) banner(`${cur.def.name}'s turn${cur.cpu ? '' : '!'}`, 'turn', 1.2);
}

function beginAim() {
  mapMode = false;
  golfer.setColor(cur.def.color);
  golfer.setSwing(-0.6);
  launcher.setTilt(0.3);
  rig.visible = true;
  setAimPoint(autoTarget(cur.pos));
  cur.frog.group.visible = true;
  cur.frog.group.scale.setScalar(1);
  cur.shadow.visible = true;
  power = 0; meterPh = 0;
  setMeter(0);
  updateBoard(); updatePin();
  if (cur.cpu) {
    phase = 'cpu'; phaseT = 0;
    cpuPlan = planCpu(cur);
    setControls('watch');
  } else {
    phase = 'aim'; phaseT = 0;
    setControls('aim');
  }
}

function placeRig() {
  rig.position.copy(cur.pos);
  rig.rotation.y = aimYaw;
  const gp = golfer.group.getWorldPosition(tmp);
  golfer.group.position.y = world.height(gp.x, gp.z) - cur.pos.y;
}

// ---------- CPU ----------
function planCpu(p) {
  let target = autoTarget(p.pos);
  const R = maxRange();
  // sometimes go for a web on the way
  for (const w of world.webs) {
    const d = hdist(p.pos, w);
    let da = yawTo(p.pos, w) - yawTo(p.pos, target);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (d > 18 && d < R * 0.95 && Math.abs(da) < 0.6 && Math.random() < 0.45) {
      target = new THREE.Vector3(w.x, w.y, w.z);
      break;
    }
  }
  const toCup = target.equals(world.cup);
  const dist = hdist(p.pos, target);
  const loft = dist < 30 ? 2 : Math.random() < 0.25 ? 0 : 1;
  const yaw = yawTo(p.pos, target) + (Math.random() - 0.5) * 0.06;
  // put the target short of the cup by roughly how far the frog will bounce and hop on
  let d = dist;
  if (toCup) {
    const v = launchVel(yaw, LOFTS[loft].deg, solvePower(p.pos, yaw, LOFTS[loft].deg, dist));
    d = Math.max(3, dist - Math.hypot(v.x, v.z) * 0.2);
  }
  // CPUs are good, not perfect, at stopping the bar
  const stop = Math.random() < 0.35 ? 1 : 0.9 + Math.random() * 0.1;
  return { yaw, loft, dist: d, stop };
}

// ---------- shooting ----------
function startMeter() {
  phase = 'meter'; phaseT = 0; meterPh = 0;
  setControls(cur.cpu ? 'watch' : 'meter');
}
function meterValue() { return meterPh < 1 ? meterPh : 2 - meterPh; }
function swing() {
  let m = meterValue();
  // stopping the bar right at the end hits the target exactly; less comes up short
  const where = seatPos(cur.pos, aimYaw).add(tmp.set(0, 2.2, 0));
  if (m >= 0.97) { m = 1; popup('PERFECT!', where, 'gold'); }
  else if (m >= 0.9) popup('Nice!', where, 'note');
  else popup('Short…', where, 'note');
  // carry scales ~linearly with (0.05 + 0.95p), so scale that to land at m × the target distance
  power = Math.max(0, (m * (0.05 + 0.95 * aimPower) - 0.05) / 0.95);
  phase = 'swing'; phaseT = 0; swingFired = false;
  rangeRing.visible = false;
  cur.strokes++;
  setControls('hidden');
  updateBoard();
}
function fire() {
  const start = seatPos(cur.pos, aimYaw);
  const v = launchVel(aimYaw, LOFTS[cur.loft].deg, power);
  shot = {
    p: cur, pos: start, vel: v, state: 'fly', t: 0, rest: cur.pos.clone(),
    hopsLeft: 0, bounces: 0, contacted: false, hopping: false, hopIn: false,
    mult: 1, chain: 0, points: 0, used: new Set(), lastDir: dirOf(aimYaw), timer: 0,
  };
  chaseDir.copy(dirOf(aimYaw));
  launcher.setTilt(-0.35);
  sfx.thwack(); sfx.croak();
  phase = 'flight'; phaseT = 0;
  reticle.group.visible = false; arcDots.visible = false; rangeRing.visible = false;
}

function award(base, label, pos, cls = '', chain = true) {
  const s = shot;
  if (chain) s.chain++;
  const f = chain ? Math.min(3, 1 + 0.5 * (s.chain - 1)) : 1;
  const pts = Math.round((base * f * s.mult) / 10) * 10;
  s.points += pts; cur.total += pts; cur.holePts += pts;
  let txt = `+${pts.toLocaleString()}`;
  if (s.mult > 1 || f > 1) txt += `<small>${s.mult > 1 ? '×' + s.mult + ' web ' : ''}${f > 1 ? 'combo ×' + f : ''}</small>`;
  popup(txt, pos, cls);
  if (label) banner(label, cls);
  updateBoard();
}

function stepShot(dt) {
  const s = shot;
  s.t += dt;
  switch (s.state) {
    case 'fly': flyStep(dt); break;
    case 'belt': beltStep(dt); break;
    case 'grab': grabStep(dt); break;
    case 'swim': swimStep(dt); break;
    case 'sink':
      s.timer -= dt;
      s.pos.lerp(tmp.copy(world.cup).add(tmp2.set(0, -0.9, 0)), Math.min(1, dt * 6));
      cur.frog.group.scale.setScalar(Math.max(0.01, s.timer / 0.7));
      if (s.timer <= 0) holeOut();
      break;
    case 'oob':
      s.timer -= dt;
      if (s.timer <= 0) { s.pos.copy(s.rest); finish(); }
      break;
  }
  if (s.t > 25 && (s.state === 'fly' || s.state === 'belt')) finish();
}

function flyStep(dt) {
  const s = shot, p = s.pos, v = s.vel;
  const prevY = p.y;
  v.y -= G * dt;
  p.addScaledVector(v, dt);
  const cx = p.x, cy = p.y + 0.4, cz = p.z;

  for (const b of world.bubbles) {
    if (!b.alive) continue;
    const dx = b.pos.x - cx, dy = b.pos.y - cy, dz = b.pos.z - cz, r = b.r + 0.55;
    if (dx * dx + dy * dy + dz * dz < r * r) {
      b.alive = false; b.pop = 0;
      sfx.pop();
      world.burst(b.pos, 0xbfe9ff, 3 * b.r);
      award(b.value, b.value >= 300 ? 'RAINBOW BUBBLE!' : '', b.pos, b.value >= 100 ? 'gold' : '');
    }
  }
  for (const f of world.flies) {
    if (!f.alive) continue;
    const dx = f.pos.x - cx, dy = f.pos.y - cy, dz = f.pos.z - cz;
    if (dx * dx + dy * dy + dz * dz < 1.8) {
      f.alive = false; world.group.remove(f.model.group);
      sfx.coin();
      award(100, s.chain >= 2 ? 'FLY FEAST!' : '', f.pos, 'gold');
      popup('Gulp!', tmp.copy(f.pos).add(tmp2.set(0, 1.2, 0)), 'note');
    }
  }
  for (const w of world.webs) {
    if (s.used.has(w) || !(prevY > w.y && p.y <= w.y && v.y < 0)) continue;
    const dx = p.x - w.x, dz = p.z - w.z;
    const c = Math.cos(w.a), sn = Math.sin(w.a);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    if (Math.abs(lx) < w.half && Math.abs(lz) < w.half) {
      s.used.add(w);
      p.y = w.y;
      v.y = Math.max(-v.y * 0.85, 14);
      v.x *= 1.1; v.z *= 1.1;
      s.mult *= 2;
      w.wobble = 1;
      s.hopping = false; s.bounces = 0; s.contacted = false;
      sfx.boing();
      world.burst(tmp.set(p.x, w.y, p.z), 0xffffff, 6);
      award(100, `WEB BOUNCE! ×${s.mult}`, p, 'web');
    }
  }
  for (const b of world.belts) {
    if (v.y > 0 || p.y > b.top || p.y < b.top - 1.5) continue;
    const rx = p.x - b.p1.x, rz = p.z - b.p1.z;
    const along = rx * b.dir.x + rz * b.dir.z, side = rx * b.perp.x + rz * b.perp.z;
    if (along >= 0 && along <= b.len && Math.abs(side) < b.w / 2) {
      s.state = 'belt'; s.belt = b; s.along = along; s.side = side * 0.6;
      p.y = b.top;
      sfx.belt();
      if (!s.used.has(b)) { s.used.add(b); award(100, 'CONVEYOR RIDE!', p, 'belt'); }
      return;
    }
  }
  for (const el of world.elephants) {
    if (el.cool > 0 || el.grabT >= 0) continue;
    const bx = el.pos.x, by = el.pos.y + 3.6, bz = el.pos.z;
    const hx = el.pos.x + Math.sin(el.yaw) * 2.9, hz = el.pos.z + Math.cos(el.yaw) * 2.9, hy = el.pos.y + 4.6;
    const d1 = Math.hypot(cx - bx, cy - by, cz - bz), d2 = Math.hypot(cx - hx, cy - hy, cz - hz);
    if (d1 < 3.4 || d2 < 2.3) {
      s.state = 'grab'; s.grab = el; s.timer = 1.2;
      el.grabT = 0;
      sfx.trumpet();
      award(500, 'ELEPHANT TOSS!', p, 'gold');
      return;
    }
  }
  for (const t of world.trees) {
    const dx = p.x - t.x, dz = p.z - t.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.5 && p.y < t.top - 1.5) {
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { v.x -= 1.6 * vn * nx; v.z -= 1.6 * vn * nz; sfx.thud(); }
      p.x = t.x + nx * 0.72; p.z = t.z + nz * 0.72;
    }
    if (!s.used.has(t)) {
      const ex = t.cx - cx, ey = t.cy - cy, ez = t.cz - cz;
      if (ex * ex + ey * ey + ez * ez < t.cr * t.cr) {
        s.used.add(t);
        v.multiplyScalar(0.35);
        v.x += (Math.random() - 0.5) * 3; v.z += (Math.random() - 0.5) * 3;
        sfx.leaves();
        popup('Thwap!', p, 'note');
      }
    }
  }
  for (const o of players) {
    if (o === cur || o.holed || o.strokes === 0 || s.used.has(o)) continue;
    if (Math.hypot(cx - o.pos.x, cy - (o.pos.y + 0.4), cz - o.pos.z) < 1.0) {
      s.used.add(o);
      v.x *= -0.4; v.z *= -0.4; v.y = Math.abs(v.y) * 0.4 + 3;
      sfx.bonk();
      award(150, 'FROG BONK!', p);
    }
  }
  // the cup
  const hd = Math.hypot(p.x - world.cup.x, p.z - world.cup.z);
  if (hd < CUP_R && p.y - world.cup.y < 0.9 && v.y < 2) {
    s.state = 'sink'; s.timer = 0.7;
    return;
  }
  const h = world.height(p.x, p.z);
  const floor = h < 0.02 ? 0 : h;          // water surface counts as the ground
  if (p.y <= floor) { p.y = floor; land(h); }
}

function land(h) {
  const s = shot, p = s.pos, v = s.vel;
  const surf = world.surface(p.x, p.z, h);
  if (surf === 'sea') {
    s.state = 'oob'; s.timer = 1.4;
    sfx.splash();
    world.burst(tmp.set(p.x, 0.3, p.z), 0xffffff, 5);
    banner('SPLASH! Out of bounds', 'bad');
    return;
  }
  if (surf === 'pond') return startSwim();
  if (!s.contacted) { s.contacted = true; s.hopsLeft = HOP_COUNT[surf] ?? 1; }
  if (surf === 'sand') { sfx.thud(); popup('Sand!', p, 'note'); return restHere(); }
  const n = world.normal(p.x, p.z);
  const vn = v.dot(n);
  if (!s.hopping && v.length() > 8 && s.bounces < 1) {
    const [e, fr] = BOUNCE[surf] || BOUNCE.rough;
    const vt = v.clone().addScaledVector(n, -vn).multiplyScalar(fr);
    v.copy(vt).addScaledVector(n, -vn * e);
    p.y = Math.max(h, 0) + 0.02;
    s.bounces++;
    sfx.thud();
    return;
  }
  if (s.hopsLeft > 0) {
    s.hopping = true;
    const dir = tmp.set(v.x, 0, v.z);
    if (dir.lengthSq() < 0.01) dir.copy(s.lastDir);
    dir.normalize();
    dir.x += n.x * 2.5; dir.z += n.z * 2.5;           // frogs drift downhill
    if (surf === 'green') {
      const tc = tmp2.set(world.cup.x - p.x, 0, world.cup.z - p.z);
      if (tc.length() < 10) dir.normalize().lerp(tc.normalize(), 0.4);
    }
    dir.normalize();
    s.lastDir.copy(dir);
    const hs = (HOP_SPEED[surf] || 2.4) * (0.45 + 0.55 * (s.hopsLeft / 3));
    v.set(dir.x * hs, HOP_VY, dir.z * hs);
    s.hopsLeft--;
    p.y = h + 0.02;
    sfx.hop();
    return;
  }
  restHere();
}

function restHere() {
  const s = shot, p = s.pos;
  const dc = hdist(p, world.cup);
  if (!s.hopIn && dc < 2.8 && world.surface(p.x, p.z) === 'green') {
    s.hopIn = true;
    const T = (2 * HOP_VY) / G, hs = dc / T;
    s.vel.set(((world.cup.x - p.x) / dc) * hs, HOP_VY, ((world.cup.z - p.z) / dc) * hs);
    s.state = 'fly'; s.hopping = true; s.hopsLeft = 0;
    p.y += 0.02;
    popup('Hop in!', p, 'note');
    sfx.hop();
    return;
  }
  if (leapForFly()) return;
  finish();
}

// After landing, a hungry frog leaps at the nearest fly in reach, flies through it and keeps
// going; when it lands again it looks for the next one, so flies chain into a combo.
const FLY_REACH = 15;
function leapForFly() {
  const s = shot, p = s.pos;
  let best = null, bd = FLY_REACH;
  for (const f of world.flies) {
    if (!f.alive || s.used.has(f)) continue;
    const d = hdist(p, f.pos);
    if (d >= bd) continue;
    // don't leap if carrying on past the fly would drop the frog in the sea
    const over = tmp.copy(f.pos).sub(p).setY(0).multiplyScalar(2).add(p);
    if (world.surface(over.x, over.z) === 'sea') continue;
    best = f; bd = d;
  }
  if (!best) return false;
  s.used.add(best);
  best.targeted = true;
  // reach the fly at the top of the leap
  const rise = Math.max(0.6, best.pos.y - (p.y + 0.4) + 0.2);
  const vy = Math.sqrt(2 * G * rise), t = vy / G;
  s.vel.set((best.pos.x - p.x) / t, vy, (best.pos.z - p.z) / t);
  s.state = 'fly'; s.hopping = true; s.hopsLeft = 0;
  p.y += 0.05;
  popup('!', tmp.copy(p).add(tmp2.set(0, 1.6, 0)), 'gold');
  sfx.hop(); sfx.croak();
  return true;
}

function beltStep(dt) {
  const s = shot, b = s.belt;
  s.along += dt * 7;
  s.side *= Math.pow(0.3, dt);
  s.pos.set(b.p1.x + b.dir.x * s.along + b.perp.x * s.side, b.top, b.p1.z + b.dir.z * s.along + b.perp.z * s.side);
  s.lastDir.copy(b.dir);
  s.vel.set(b.dir.x * 7, 0, b.dir.z * 7);
  if (s.along > b.len) {
    s.state = 'fly';
    s.vel.set(b.dir.x * 7, 3, b.dir.z * 7);
    s.hopping = true; s.hopsLeft = 1; s.contacted = true;
  }
}

function grabStep(dt) {
  const s = shot, el = s.grab;
  s.timer -= dt;
  el.model.tip.getWorldPosition(s.pos);
  s.pos.y -= 0.4;
  if (s.timer <= 0) {
    el.grabT = -1; el.cool = 4;
    const from = s.pos.clone();
    const toCup = tmp.set(world.cup.x - from.x, 0, world.cup.z - from.z);
    let R = toCup.length();
    toCup.normalize();
    R = Math.min(R, 70);
    const target = from.clone().addScaledVector(toCup, R);
    target.x += (Math.random() - 0.5) * 7; target.z += (Math.random() - 0.5) * 7;
    const d = Math.max(3, hdist(from, target) - 2);
    const th = (50 * Math.PI) / 180;
    const sp = Math.sqrt((d * G) / Math.sin(2 * th));
    const yaw = yawTo(from, target);
    s.vel.set(Math.sin(yaw) * Math.cos(th) * sp, Math.sin(th) * sp, Math.cos(yaw) * Math.cos(th) * sp);
    s.state = 'fly'; s.hopping = false; s.bounces = 0; s.contacted = false;
    sfx.boing();
  }
}

function startSwim() {
  const s = shot, p = s.pos;
  let to = null;
  for (let r = 1; r < 40 && !to; r += 1) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const h = world.height(x, z);
      if (h > 0.25) { const sf = world.surface(x, z, h); if (sf !== 'pond' && sf !== 'sea') { to = new THREE.Vector3(x, h, z); break; } }
    }
  }
  if (!to) to = s.rest.clone();
  s.state = 'swim';
  s.swimFrom = p.clone(); s.swimTo = to;
  s.timer = 0; s.swimDur = Math.min(3, Math.max(1, hdist(p, to) / 3));
  sfx.splash();
  world.burst(tmp.set(p.x, 0.3, p.z), 0xffffff, 4);
  award(100, 'SWIM BONUS!', p, 'belt');
}

function swimStep(dt) {
  const s = shot;
  s.timer += dt;
  const k = Math.min(1, s.timer / s.swimDur);
  s.pos.lerpVectors(s.swimFrom, s.swimTo, k);
  if (k < 0.92) s.pos.y = -0.25 + Math.sin(s.timer * 10) * 0.05;
  s.lastDir.set(s.swimTo.x - s.swimFrom.x, 0, s.swimTo.z - s.swimFrom.z).normalize();
  if (k >= 1) { s.pos.copy(s.swimTo); s.state = 'fly'; restHere(); }
}

function holeOut() {
  const s = shot, p = cur;
  p.holed = true;
  const bonus = HOLE_BONUS[Math.min(p.strokes, HOLE_BONUS.length - 1)];
  const label = p.strokes === 1 ? 'HOLE IN ONE!!' : p.strokes === 2 ? 'GREAT SHOT!' : 'IN THE HOLE!';
  sfx.ding();
  award(bonus, label, world.cup, 'big', false);
  if (!firstIn && players.length > 1) {
    award(500, '', tmp.copy(world.cup).add(tmp2.set(0, 2, 0)), 'gold', false);
    popup('First in!', tmp.copy(world.cup).add(tmp2.set(0, 3.5, 0)), 'note');
  }
  firstIn = true;
  cur.frog.group.visible = false; cur.shadow.visible = false;
  finish(true);
}

function finish(holed = false) {
  const s = shot;
  for (const f of world.flies) f.targeted = false;
  s.state = 'done';
  if (!holed) {
    cur.pos.copy(s.pos);
    cur.pos.y = world.height(s.pos.x, s.pos.z);
  }
  phase = 'after'; phaseT = 0;
  if (!holed && cur.strokes >= MAX_STROKES) {
    cur.holed = true; cur.picked = true;
    cur.frog.group.visible = false; cur.shadow.visible = false;
    banner('Picked up — out of strokes', 'bad');
  } else if (!holed && s.points > 0) {
    banner(`Shot: +${s.points.toLocaleString()}`, 'score', 1.3);
  }
  updateBoard(); updatePin();
}

function endHole() {
  phase = 'holeEnd';
  rig.visible = false;
  setControls('hidden');
  players.forEach(p => p.holes.push(p.holePts));
  const last = holeIdx === holeList.length - 1;
  const sorted = [...players].sort((a, b) => b.total - a.total);
  if (last) {
    const top = sorted[0];
    const humanBest = Math.max(0, ...players.filter(p => !p.cpu).map(p => p.total));
    let newBest = false;
    if (humanBest > best) { best = humanBest; newBest = true; try { localStorage.setItem('frolf.best', String(best)); } catch { /* ignore */ } }
    sfx.fanfare();
    $('sumTitle').textContent = players.length > 1 ? `${top.def.name} wins!` : 'Course complete!';
    $('sumSub').textContent = newBest ? `New best score: ${best.toLocaleString()}!` : best ? `Best: ${best.toLocaleString()}` : '';
    $('nextBtn').textContent = 'Play again';
  } else {
    $('sumTitle').textContent = `Hole ${holeIdx + 1} done`;
    $('sumSub').textContent = holeList[holeIdx].name;
    $('nextBtn').textContent = `Hole ${holeIdx + 2} →`;
  }
  $('sumTable').innerHTML = `<tr><th></th>${holeList.slice(0, holeIdx + 1).map((_, i) => `<th>${i + 1}</th>`).join('')}<th>Total</th></tr>` +
    sorted.map(p => `<tr><td><i style="background:${p.def.css}"></i>${p.def.name}</td>${p.holes.map(v => `<td>${short(v)}</td>`).join('')}<td><b>${p.total.toLocaleString()}</b></td></tr>`).join('');
  $('summary').classList.remove('hidden');
}
$('nextBtn').addEventListener('click', () => {
  $('summary').classList.add('hidden');
  if (holeIdx === holeList.length - 1) {
    phase = 'title';
    $('hud').classList.add('hidden');
    $('title').classList.remove('hidden');
    renderSetup();
    return;
  }
  holeIdx++;
  loadHole();
});

// ---------- input ----------
// Behind the frog: drag sideways to turn, drag up/down to move the target farther/closer, tap the
// ground to put the target there. MAP view: touch or drag anywhere and the target follows your finger.
let drag = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function groundAt(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(world.terrain)[0];
  if (hit) return hit.point;
  // past the terrain edge: use the sea plane
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  return t > 0 ? ray.ray.origin.clone().addScaledVector(ray.ray.direction, t) : null;
}
const canAim = () => phase === 'aim' && cur && !cur.cpu;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (phase === 'intro' && phaseT > 0.3) { phaseT = 99; return; }
  drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  if (canAim() && mapMode) { const p = groundAt(e); if (p) setAimPoint(p); }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (!canAim()) return;
  if (mapMode) {
    const p = groundAt(e);
    if (p) setAimPoint(p);
  } else {
    aimYaw -= dx * 0.005;
    aimDist -= dy * 0.2;
    updateAim();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const tap = drag.moved < 10;
  drag = null;
  if (tap && canAim() && !mapMode) { const p = groundAt(e); if (p) setAimPoint(p); }
});
canvas.addEventListener('pointercancel', () => { drag = null; });

function onSwing() {
  unlockAudio();
  if (!cur || cur.cpu) return;
  if (phase === 'aim') startMeter();
  else if (phase === 'meter') swing();
}
$('swingBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); onSwing(); });
$('loftBtn').addEventListener('click', () => {
  if (phase !== 'aim' || cur.cpu) return;
  cur.loft = (cur.loft + 1) % LOFTS.length;
  updateAim();
  setControls('aim');
});
$('mapBtn').addEventListener('click', () => {
  if (phase !== 'aim') return;
  mapMode = !mapMode;
  $('mapBtn').classList.toggle('on', mapMode);
});
$('menuBtn').addEventListener('click', () => {
  if (!confirm('Quit this game and go back to the title?')) return;
  $('summary').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('title').classList.remove('hidden');
  phase = 'title';
  rig.visible = reticle.group.visible = arcDots.visible = rangeRing.visible = false;
  players.forEach(p => { p.frog.group.visible = p.shadow.visible = false; });
  renderSetup();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); onSwing(); }
  if (canAim() && e.code === 'ArrowLeft') { aimYaw += 0.03; updateAim(); }
  if (canAim() && e.code === 'ArrowRight') { aimYaw -= 0.03; updateAim(); }
  if (canAim() && e.code === 'ArrowUp') { aimDist += 2; updateAim(); }
  if (canAim() && e.code === 'ArrowDown') { aimDist -= 2; updateAim(); }
});

// ---------- per-frame ----------
const dotM = new THREE.Matrix4();
function showAim() {
  reticle.group.visible = true;
  reticle.group.position.copy(aimLand);
  reticle.group.scale.setScalar(mapMode ? 2.2 : 1);
  reticle.col.scale.set(1, phase === 'meter' ? 1 : 0.6, 1);
  arcDots.visible = true;
  const step = Math.max(1, Math.floor(arcPts.length / ARC_N));
  let n = 0;
  for (let i = 0; i < arcPts.length && n < ARC_N; i += step) {
    dotM.makeTranslation(arcPts[i].x, arcPts[i].y, arcPts[i].z);
    arcDots.setMatrixAt(n++, dotM);
  }
  arcDots.count = n;
  arcDots.instanceMatrix.needsUpdate = true;
  // reach ring
  rangeRing.visible = phase === 'aim' || phase === 'cpu';
  if (rangeRing.visible) {
    const R = maxRange(cur.loft);
    for (let i = 0; i < RING_N; i++) {
      const a = (i / RING_N) * Math.PI * 2;
      const x = cur.pos.x + Math.sin(a) * R, z = cur.pos.z + Math.cos(a) * R;
      dotM.makeScale(mapMode ? 2.4 : 1, mapMode ? 2.4 : 1, mapMode ? 2.4 : 1).setPosition(x, Math.max(0, world.height(x, z)) + 0.35, z);
      rangeRing.setMatrixAt(i, dotM);
    }
    rangeRing.instanceMatrix.needsUpdate = true;
  }
}

function aimCamera(k = 1) {
  const d = dirOf(aimYaw);
  if (mapMode) {
    // frame the frog and the cup (fixed for the turn, so the view holds still while you drag)
    const R = maxRange(cur.loft) * 0.6;
    const x0 = Math.min(cur.pos.x, world.cup.x) - 22, x1 = Math.max(cur.pos.x, world.cup.x) + 22;
    const z0 = Math.min(cur.pos.z, world.cup.z) - 22, z1 = Math.max(cur.pos.z, world.cup.z) + 22;
    const W = Math.max(x1 - x0, R), D = Math.max(z1 - z0, R);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const H = Math.max(D / 2 / tan, W / 2 / (tan * camera.aspect)) * 1.25;
    // nudge the picture up so the bottom controls don't cover the frog
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2 + H * tan * 0.22;
    camPosT.set(cx, H, cz + H * 0.08);
    camLookT.set(cx, 0, cz);
  } else {
    // behind and a little to the right, so the golfer stands off to the left of the shot line
    const right = tmp2.set(-d.z, 0, d.x);
    camPosT.copy(cur.pos).addScaledVector(d, -10.5 * k).addScaledVector(right, 2.2).add(tmp.set(0, 5.6, 0));
    camLookT.copy(cur.pos).addScaledVector(d, 26).addScaledVector(right, 0.6).add(tmp.set(0, 0.5, 0));
  }
}

function tick(dt) {
  time += dt;
  phaseT += dt;
  if (world) world.update(dt, time);
  sea.position.y = Math.sin(time * 0.8) * 0.05;

  if (phase === 'title') {
    const a = time * 0.06;
    camPosT.set(Math.cos(a) * 55, 24, -50 + Math.sin(a) * 55);
    camLookT.set(0, 0, -50);
  } else if (phase === 'intro') {
    const k = ease(Math.min(1, phaseT / 3.2));
    const d = tmp.copy(world.cup).sub(world.tee).setY(0).normalize();
    const startPos = world.cup.clone().addScaledVector(d, 30).add(tmp2.set(0, 38, 0));
    const endPos = world.tee.clone().addScaledVector(d, -9).add(tmp2.set(0, 5, 0));
    camPosT.lerpVectors(startPos, endPos, k);
    camLookT.lerpVectors(world.cup, world.tee.clone().addScaledVector(d, 20), k);
    camPos.copy(camPosT); camLook.copy(camLookT);
    if (phaseT > 3.4) { bannerTimer = 0; nextTurn(); }
  } else if (phase === 'aim') {
    aimCamera();
    showAim();
    $('meterRange').textContent = `TARGET ${aimDist.toFixed(0)}m`;
  } else if (phase === 'cpu') {
    let d = cpuPlan.yaw - aimYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    aimYaw += d * Math.min(1, dt * 3);
    aimDist += (cpuPlan.dist - aimDist) * Math.min(1, dt * 3);
    if (phaseT > 0.5) cur.loft = cpuPlan.loft;
    updateAim();
    aimCamera();
    showAim();
    if (phaseT > 1.4) { aimYaw = cpuPlan.yaw; aimDist = cpuPlan.dist; updateAim(); startMeter(); }
  } else if (phase === 'meter') {
    const prev = meterValue();
    meterPh += dt * meterSpeed;
    if (meterPh >= 2) { phase = 'aim'; meterPh = 0; setMeter(0); setControls('aim'); popup('Missed — try again', tmp.copy(cur.pos).add(tmp2.set(0, 2.5, 0)), 'note'); return; }
    const m = meterValue();
    if (Math.floor(m * 10) !== Math.floor(prev * 10)) sfx.tick();
    aimCamera();
    showAim();
    setMeter(m);
    if (cur.cpu && (meterPh >= 1 ? 2 - meterPh <= cpuPlan.stop : meterPh >= cpuPlan.stop)) swing();
  } else if (phase === 'swing') {
    const t = phaseT;
    if (t < 0.3) golfer.setSwing(lerp(-0.6, -1.4, ease(t / 0.3)));
    else if (t < 0.42) golfer.setSwing(lerp(-1.4, 1.95, (t - 0.3) / 0.12));
    else golfer.setSwing(1.95);
    if (!swingFired && t >= 0.4) { swingFired = true; fire(); }
    aimCamera();
  } else if (phase === 'flight') {
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n && shot.state !== 'done'; i++) stepShot(dt / n);
    flightCamera(dt);
  } else if (phase === 'after') {
    if (phaseT > 1.5) nextTurn();
  }

  // frogs
  for (const p of players) {
    const g = p.frog.group;
    if (!g.visible) continue;
    if (shot && shot.state !== 'done' && p === shot.p) {
      g.position.copy(shot.pos);
      const s = shot;
      if (s.state === 'fly' || s.state === 'grab') {
        g.rotation.y = Math.atan2(s.vel.x, s.vel.z);
        g.rotation.x = Math.max(-0.8, Math.min(0.8, -s.vel.y * 0.04));
        p.frog.setStretch(1);
      } else {
        g.rotation.y = Math.atan2(s.lastDir.x, s.lastDir.z);
        g.rotation.x = 0;
        p.frog.setStretch(s.state === 'swim' ? 0.6 + Math.sin(time * 12) * 0.4 : 0);
      }
    } else if (p === cur && (phase === 'aim' || phase === 'cpu' || phase === 'meter' || phase === 'swing')) {
      g.position.copy(seatPos(p.pos, aimYaw));
      g.position.y = p.pos.y + 0.2 + Math.max(0, Math.sin(time * 3)) * 0.04;
      g.rotation.set(0, aimYaw, 0);
      p.frog.setStretch(0);
    } else {
      g.position.copy(p.pos);
      g.rotation.x = 0;
      p.frog.setStretch(0);
    }
    const sh = p.shadow;
    sh.visible = g.visible;
    const gh = Math.max(0, world.height(g.position.x, g.position.z));
    sh.position.set(g.position.x, gh + 0.06, g.position.z);
    sh.scale.setScalar(Math.max(0.35, 1.2 - (g.position.y - gh) * 0.03));
  }

  // camera
  const kp = phase === 'flight' ? 4 : mapMode ? 3 : 5;
  camPos.lerp(camPosT, 1 - Math.exp(-kp * dt));
  camLook.lerp(camLookT, 1 - Math.exp(-6 * dt));
  if (world) {
    const floor = world.height(camPos.x, camPos.z) + 1.5;
    if (camPos.y < floor) camPos.y = floor;
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  // UI
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').className = ''; }
  for (let i = popups.length - 1; i >= 0; i--) {
    const u = popups[i];
    u.t += dt;
    tmp.copy(u.pos).add(tmp2.set(0, 1.5 + u.t * 2.5, 0)).project(camera);
    if (u.t > 1.4 || tmp.z > 1) { u.el.remove(); popups.splice(i, 1); continue; }
    u.el.style.transform = `translate(${((tmp.x + 1) / 2) * window.innerWidth}px, ${((1 - tmp.y) / 2) * window.innerHeight}px) translate(-50%,-50%) scale(${Math.min(1, u.t * 6)})`;
    u.el.style.opacity = String(Math.min(1, (1.4 - u.t) * 3));
  }
}

function flightCamera(dt) {
  const s = shot;
  const p = s.pos;
  if (s.state === 'grab') {
    const el = s.grab;
    const side = tmp2.set(Math.cos(el.yaw), 0, -Math.sin(el.yaw));
    camPosT.copy(el.pos).addScaledVector(side, 16).add(tmp.set(0, 8, 0));
    camLookT.copy(el.pos).add(tmp.set(0, 4, 0));
    return;
  }
  const hv = tmp.set(s.vel.x, 0, s.vel.z);
  if (hv.lengthSq() > 4) chaseDir.lerp(hv.normalize(), 1 - Math.exp(-1.5 * dt)).normalize();
  const gh = world.height(p.x, p.z);
  camPosT.copy(p).addScaledVector(chaseDir, -11).add(tmp.set(0, 5 + Math.max(0, p.y - gh) * 0.15, 0));
  camLookT.copy(p).addScaledVector(chaseDir, 5);
  if (s.state === 'done' || phase === 'after') camLookT.copy(p);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// title backdrop: show hole 1 behind the menu
(function titleBackdrop() {
  world = new World(HOLES[0], 0);
  scene.add(world.group);
  camPos.set(30, 26, 20); camLook.set(0, 0, -60);
  camPosT.copy(camPos); camLookT.copy(camLook);
})();

// test hook: lets tooling drive frames when the tab is hidden
window.__frolf = {
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); renderer.render(scene, camera); },
  get state() { return { phase, hole: holeIdx, cur: cur && cur.def.name, shot: shot && shot.state, players: players.map(p => ({ n: p.def.name, total: p.total, strokes: p.strokes, holed: p.holed })) }; },
  setAim(yaw, dist, loft) { aimYaw = yaw; if (dist != null) aimDist = dist; if (loft != null) cur.loft = loft; updateAim(); },
  aimAt(x, z) { setAimPoint(new THREE.Vector3(x, 0, z)); },
  get aim() { return { yaw: aimYaw, dist: aimDist, max: aimMax, power: aimPower, speed: meterSpeed, land: aimLand.clone() }; },
  get world() { return world; },
  goto(i) { holeIdx = i; loadHole(); },
  map(on = true) { mapMode = on; },
};
