import * as THREE from 'three';
import { WORLDS } from './holes.js';
import { World, SNAKE_R, ELEPHANT_R } from './world.js';
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
// sinking it is worth less than a good combo run; fewer strokes still pays
const HOLE_BONUS = [0, 1000, 600, 400, 300, 200, 150, 100, 50];
// backpack items: everyone starts each game with one of each; "?" circles hand out more
const ITEMS = {
  goggles: { icon: '👀', name: 'Fly Eyes', desc: 'See and eat flies twice as far away' },
  spring: { icon: '🚀', name: 'Rocket Launch', desc: 'Launch about 30% farther' },
  sticky: { icon: '🍯', name: 'Sticky Feet', desc: 'No hopping: stop where you land' },
  boots: { icon: '🦘', name: 'Super Hops', desc: 'Bigger, more hops after landing' },
};
const ITEM_KEYS = Object.keys(ITEMS);
const SPRING = 1.14;          // launch-speed boost from Rocket Launch (about 1.3x carry)
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
const sky = M.makeSky();
scene.add(sky);
const sea = M.makeSea();
scene.add(sea);
scene.add(M.makeClouds());
const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x5c8a3c, 1.5);
scene.add(hemi);
const snow = M.makeSnow();
snow.visible = false;
scene.add(snow);
// sky, fog, sea and light for each world
const THEMES = {
  tropical: { top: 0x2f8cf0, mid: 0x8fd0ff, low: 0xe4f7ff, fog: 0xd6f1ff, sea: 0x27b0e6, hemiSky: 0xe8f6ff, hemiGround: 0x5c8a3c, snow: false },
  ice: { top: 0x5f8fc4, mid: 0xb8d3ec, low: 0xf2f7fd, fog: 0xe4eef8, sea: 0x2a6890, hemiSky: 0xf2f8ff, hemiGround: 0x9eb2c6, snow: true },
};
function applyTheme(name) {
  const t = THEMES[name] || THEMES.tropical;
  sky.material.uniforms.top.value.set(t.top);
  sky.material.uniforms.mid.value.set(t.mid);
  sky.material.uniforms.low.value.set(t.low);
  scene.fog.color.set(t.fog);
  sea.material.color.set(t.sea);
  hemi.color.set(t.hemiSky);
  hemi.groundColor.set(t.hemiGround);
  snow.visible = t.snow;
  document.body.dataset.world = name;
}
function makeWorld(key, i) {
  const W = WORLDS[key];
  applyTheme(W.theme);
  return new World(W.holes[i], i + (key === 'ice' ? 100 : 0), W.theme);
}
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
const setup = { slots: ['you', 'cpu', 'off', 'off'], holes: 6, world: 'tropical' };
let best = 0;
const bestKey = () => (setup.world === 'tropical' ? 'frolf.best' : 'frolf.best.' + setup.world);
function loadBest() { try { best = Number(localStorage.getItem(bestKey())) || 0; } catch { best = 0; } }
loadBest();

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
const boost = () => (cur && cur.equipped === 'spring' ? SPRING : 1);
function launchVel(yaw, deg, p) {
  const s = VMAX * boost() * Math.sqrt(0.05 + 0.95 * p);
  const a = (deg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(a) * s, Math.sin(a) * s, Math.cos(yaw) * Math.cos(a) * s);
}
function seatPos(rest, yaw) {
  return new THREE.Vector3(rest.x + Math.sin(yaw) * 1.0, rest.y + 0.2, rest.z + Math.cos(yaw) * 1.0);
}
// ballistic preview ignoring gimmicks; fills `pts` with points along the arc
function predict(start, vel, pts, every = 4) {
  const p = start.clone(), v = vel.clone();
  const dt = 1 / 60;
  for (let i = 0; i < 900; i++) {
    v.y -= G * dt;
    p.addScaledVector(v, dt);
    if (pts && i % every === 0) pts.push(p.clone());
    const h = world.height(p.x, p.z);
    if (v.y < 0 && p.y <= Math.max(h, 0)) { p.y = Math.max(h, 0); return p; }
  }
  return p;
}
function maxRange(loft = 1) { return (VMAX * VMAX * boost() * boost() * Math.sin((2 * LOFTS[loft].deg * Math.PI) / 180)) / G; }

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
  pathPts.length = 0;
  aimLand.copy(predict(start, launchVel(aimYaw, deg, aimPower), pathPts, 1));
  arcPts.length = 0;
  for (let i = 0; i < pathPts.length; i += 4) arcPts.push(pathPts[i]);
  highlightPath();
  // longer shots make the power bar run faster
  meterSpeed = lerp(0.55, 1.45, Math.min(1.15, aimDist / (maxRange(1) / boost() / boost())));
  placeRig();
}
// light up every bubble the planned flight passes through
const pathPts = [];
function highlightPath() {
  for (const b of world.bubbles) {
    b.hl = false;
    if (!b.alive) continue;
    const r2 = (b.r + 0.55) ** 2;
    for (const q of pathPts) {
      const dx = q.x - b.pos.x, dy = q.y + 0.4 - b.pos.y, dz = q.z - b.pos.z;
      if (dx * dx + dy * dy + dz * dz < r2) { b.hl = true; break; }
    }
  }
}
function clearHighlights() { if (world) for (const b of world.bubbles) b.hl = false; }
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
      <b>${p.total.toLocaleString()}</b><em>${p.holed ? '✓' : `${p.strokes}/${MAX_STROKES}`}</em>
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
  if (mode !== 'aim') $('bag').classList.add('hidden');
  renderBag();
  $('loftBtn').textContent = LOFTS[cur ? cur.loft : 1].name;
  $('swingBtn').textContent = mode === 'meter' ? 'HIT!' : 'SWING';
  $('mapBtn').classList.toggle('on', mapMode);
}
function setMeter(m) {
  $('meterFill').style.width = `${(m * 100).toFixed(1)}%`;
  $('meterWrap').classList.toggle('hot', m >= 0.97);
  if (cur) $('meterRange').textContent = `TARGET ${aimDist.toFixed(0)}m${cur.equipped ? ' ' + ITEMS[cur.equipped].icon : ''}`;
}

// backpack
function renderBag() {
  if (!cur || !cur.bag) return;
  $('bagBtn').textContent = cur.equipped ? ITEMS[cur.equipped].icon : '🎒';
  $('bagBtn').classList.toggle('on', !!cur.equipped);
  $('bag').innerHTML = '<p>Pick one item for this shot</p>' + ITEM_KEYS.map(k => `
    <button class="item${cur.equipped === k ? ' on' : ''}" data-k="${k}" ${cur.bag[k] ? '' : 'disabled'}>
      <span>${ITEMS[k].icon}</span><b>${ITEMS[k].name}</b><small>${ITEMS[k].desc}</small><em>×${cur.bag[k]}</em>
    </button>`).join('');
}
$('bagBtn').addEventListener('click', () => {
  if (phase !== 'aim' || cur.cpu) return;
  renderBag();
  $('bag').classList.toggle('hidden');
});
$('bag').addEventListener('click', (e) => {
  const b = e.target.closest('.item');
  if (!b || b.disabled || phase !== 'aim') return;
  const k = b.dataset.k;
  cur.equipped = cur.equipped === k ? null : k;
  updateAim();
  renderBag();
  $('bag').classList.add('hidden');
});
function giveItem(p) {
  const k = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
  p.bag[k]++;
  return k;
}

// elephant countdown
function showCountdown(text) {
  const el = $('countdown');
  el.textContent = text;
  el.className = text ? 'show' + (text === 'GO!' ? ' go' : '') : '';
}
function setPressButton(on) { $('pressBtn').classList.toggle('hidden', !on); }
$('pressBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (shot && shot.state === 'elephant' && shot.pressT === null) { shot.pressT = shot.et; sfx.thwack(); setPressButton(false); }
});

// ---------- title / setup ----------
function renderSetup() {
  for (const b of document.querySelectorAll('#worlds .world')) b.classList.toggle('on', b.dataset.w === setup.world);
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
$('worlds').addEventListener('click', (e) => {
  const b = e.target.closest('.world');
  if (!b || b.dataset.w === setup.world) return;
  setup.world = b.dataset.w;
  loadBest();
  showBackdrop();
  renderSetup();
});
$('playBtn').addEventListener('click', () => { unlockAudio(); sfx.croak(); startGame(); });
renderSetup();

function startGame() {
  players.forEach(p => { scene.remove(p.frog.group, p.shadow); });
  players = setup.slots.map((s, i) => s === 'off' ? null : {
    def: PLAYER_DEFS[i], cpu: s === 'cpu', total: 0, holes: [], loft: 1,
    frog: M.makeFrog(PLAYER_DEFS[i].color), shadow: M.makeShadow(), pos: new THREE.Vector3(), strokes: 0, holed: false, holePts: 0,
    bag: { goggles: 1, spring: 1, sticky: 1, boots: 1 }, equipped: null,
  }).filter(Boolean);
  players.forEach(p => scene.add(p.frog.group, p.shadow));
  holeList = WORLDS[setup.world].holes.slice(0, setup.holes);
  holeIdx = 0;
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  loadHole();
}

function loadHole() {
  if (world) { scene.remove(world.group); world.dispose(); }
  const h = holeList[holeIdx];
  world = makeWorld(setup.world, holeIdx);
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
  // strict rotation: everyone still out on the hole takes one stroke in turn, ahead or behind.
  // Nobody goes twice in a row unless everyone else has already holed out.
  const n = players.length;
  const from = cur ? players.indexOf(cur) : (holeIdx % n) - 1;
  const prev = cur;
  for (let k = 1; k <= n; k++) {
    const p = players[(from + k + n) % n];
    if (!p.holed) { cur = p; break; }
  }
  beginAim();
  if (players.length > 1 && cur !== prev) banner(`${cur.def.name}'s turn${cur.cpu ? '' : '!'}`, 'turn', 1.2);
}

function beginAim() {
  mapMode = false;
  cur.equipped = null;
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
// The CPU weighs every gimmick in reach against heading home: early on it hunts combos,
// and the more strokes it has taken the more it wants the cup.
function planCpu(p) {
  const has = (k) => p.bag[k] > 0;
  const remaining = hdist(p.pos, world.cup);
  // a long way from home: sometimes fire up the rocket
  if (has('spring') && remaining > maxRange() * 0.95 && Math.random() < 0.4) p.equipped = 'spring';
  const R = maxRange() * 0.95;
  const urgency = 1 + p.strokes * 1.2;
  const opts = [];
  const add = (pt, value, kind, loft = 1) => {
    const d = hdist(p.pos, pt);
    if (d < 8 || d > R) return;
    const after = hdist(pt, world.cup);
    opts.push({ pt, kind, loft, score: value + (remaining - after) * 2 - urgency * Math.max(0, after - 30) + Math.random() * 150 });
  };
  const toward = (from, to, k) => from.clone().add(tmp.copy(to).sub(from).setY(0).normalize().multiplyScalar(k));
  if (remaining <= R) {
    opts.push({ pt: world.cup.clone(), kind: 'cup', loft: remaining < 30 ? 2 : 1,
      score: HOLE_BONUS[Math.min(p.strokes + 1, HOLE_BONUS.length - 1)] + (firstIn ? 0 : 300) + p.strokes * 150 + Math.random() * 150 });
  } else {
    add(autoTarget(p.pos), 100, 'line');
  }
  for (const w of world.webs) add(new THREE.Vector3(w.x, w.y, w.z), 450, 'web');
  for (const sn of world.snakes) add(toward(new THREE.Vector3(sn.x, sn.y, sn.z), p.pos, 3), 350, 'snake');
  for (const el of world.elephants) add(toward(el.pos.clone(), p.pos, 6.5), 400, 'elephant');
  for (const [px, pz] of world.ponds) add(new THREE.Vector3(px, 0, pz), 280, 'pond');
  for (const st of world.streams) { const q = st.pts[0]; add(new THREE.Vector3(q.x, 0, q.z), 340, 'stream'); }
  for (const b of world.belts) add(b.p1.clone().addScaledVector(b.dir, 3).setY(b.top), 320, 'belt', 2);
  for (const [mx, mz] of world.mountains) add(new THREE.Vector3(mx, world.height(mx, mz), mz), 600, 'mountain', 2);
  for (const f of world.flies) if (f.alive) add(f.center.clone(), 160, 'flies');
  for (const m of world.mysteries) if (!m.used) add(new THREE.Vector3(m.x, m.y, m.z), 300, 'mystery', 2);
  for (const pd of world.pads) add(new THREE.Vector3(pd.x, 0, pd.z), 260, 'pad', 2);
  for (const pt of world.portals) add(new THREE.Vector3(pt.x, pt.y, pt.z), 200, 'portal', 2);
  opts.sort((a, b) => b.score - a.score);
  const pick = opts[0] || { pt: autoTarget(p.pos), kind: 'line', loft: 1 };
  const target = pick.pt;
  const dist = hdist(p.pos, target);
  const loft = pick.loft;
  const yaw = yawTo(p.pos, target) + (Math.random() - 0.5) * 0.05;
  // put the target short of the cup by roughly how far the frog will bounce and hop on
  let d = dist;
  if (!p.equipped) {
    if ((pick.kind === 'cup' || pick.kind === 'mystery' || pick.kind === 'pad') && dist > 25 && has('sticky')) p.equipped = 'sticky';
    else if (pick.kind === 'flies' && has('goggles')) p.equipped = 'goggles';
    else if (pick.kind === 'line' && has('boots') && Math.random() < 0.3) p.equipped = 'boots';
  }
  if (pick.kind === 'cup' && p.equipped !== 'sticky') {
    const v = launchVel(yaw, LOFTS[loft].deg, solvePower(p.pos, yaw, LOFTS[loft].deg, dist));
    d = Math.max(3, dist - Math.hypot(v.x, v.z) * 0.2);
  }
  // landing on ice? the frog will skid on, so land short by about the skid (ice friction 3.5 m/s²)
  if (p.equipped !== 'sticky') {
    for (let k = 0; k < 4; k++) {
      const lx = p.pos.x + Math.sin(yaw) * d, lz = p.pos.z + Math.cos(yaw) * d;
      if (world.surface(lx, lz) !== 'ice') break;
      if (has('sticky')) { p.equipped = 'sticky'; break; }
      const v = launchVel(yaw, LOFTS[loft].deg, solvePower(p.pos, yaw, LOFTS[loft].deg, d));
      const skid = (Math.hypot(v.x, v.z) * 0.8) ** 2 / 7;
      d = Math.max(3, d - Math.min(skid, d * 0.5));
    }
  }
  // CPUs are good, not perfect, at stopping the bar
  const stop = Math.random() < 0.35 ? 1 : 0.9 + Math.random() * 0.1;
  return { yaw, loft, dist: d, stop, kind: pick.kind };
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
  if (cur.equipped) {
    cur.bag[cur.equipped]--;
    popup(`${ITEMS[cur.equipped].icon} ${ITEMS[cur.equipped].name}!`, seatPos(cur.pos, aimYaw).add(tmp.set(0, 3.4, 0)), 'gold');
  }
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
    mult: 1, chain: 0, points: 0, used: new Set(), lastDir: dirOf(aimYaw), timer: 0, item: cur.equipped,
  };
  cur.equipped = null;
  clearHighlights();
  chaseDir.copy(dirOf(aimYaw));
  launcher.setTilt(-0.35);
  sfx.thwack(); sfx.croak();
  phase = 'flight'; phaseT = 0;
  reticle.group.visible = false; arcDots.visible = false; rangeRing.visible = false;
}

// Points for the current shot. Gimmicks build a combo (up to ×3) and every web passed doubles
// everything after it. Per-second trickles (swimming, belts, sliding) and penalties skip the combo.
function award(base, label, pos, cls = '', chain = true) {
  const s = shot;
  let pts, f = 1;
  if (base < 0) {
    pts = base;
  } else {
    if (chain) { s.chain++; f = Math.min(2, 1 + 0.25 * (s.chain - 1)); }
    pts = Math.round((base * f * s.mult) / 10) * 10;
  }
  s.points += pts; cur.total += pts; cur.holePts += pts;
  let txt = `${pts < 0 ? '' : '+'}${pts.toLocaleString()}`;
  if (pts > 0 && (s.mult > 1 || f > 1)) txt += `<small>${s.mult > 1 ? '×' + s.mult + ' web ' : ''}${f > 1 ? 'combo ×' + f : ''}</small>`;
  popup(txt, pos, pts < 0 ? 'bad' : cls);
  if (label) banner(label, pts < 0 ? 'bad' : cls);
  updateBoard();
}

function stepShot(dt) {
  const s = shot;
  s.t += dt;
  switch (s.state) {
    case 'fly': flyStep(dt); break;
    case 'belt': beltStep(dt); break;
    case 'elephant': elephantStep(dt); break;
    case 'snake': snakeStep(dt); break;
    case 'swim': swimStep(dt); break;
    case 'slide': slideStep(dt); break;
    case 'pad': padStep(dt); break;
    case 'portal': portalStep(dt); break;
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
  if (s.t > 80 && s.state !== 'done' && s.state !== 'sink') finish();
}

// bubbles and flies the frog touches, whatever it is doing
function checkPickups(cx, cy, cz) {
  const s = shot;
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
      award(20, s.chain >= 3 ? 'FLY FEAST!' : '', f.pos, 'gold');
      popup('Gulp!', tmp.copy(f.pos).add(tmp2.set(0, 1.2, 0)), 'note');
    }
  }
}

function inWeb(w, x, z, margin = 0) {
  const dx = x - w.x, dz = z - w.z, c = Math.cos(w.a), sn = Math.sin(w.a);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  return Math.abs(lx) < w.half + margin && Math.abs(lz) < w.half + margin;
}

// Spider webs are trampolines on the ground: the frog always bounces high, keeps going the way
// it was heading, and every point after this doubles.
function webBounce(w, strong = false) {
  const s = shot, p = s.pos, v = s.vel;
  s.used.add(w);
  p.y = w.y + 0.02;
  const hv = tmp.set(v.x, 0, v.z);
  let sp = hv.length();
  if (sp < 0.5) hv.copy(s.lastDir);
  hv.normalize();
  // big webs fling you much farther
  // jumping onto a web straight out of the water gets an extra-strong launch
  sp = w.big ? Math.max(sp * 1.3, strong ? 15 : 13) : Math.max(sp * 1.1, strong ? 9.5 : 7);
  v.set(hv.x * sp, Math.max(-v.y * 0.85, w.big ? (strong ? 21 : 20) : (strong ? 15 : 14)), hv.z * sp);
  s.lastDir.copy(hv);
  s.mult = Math.min(4, s.mult * 2);      // webs stack, but only up to x4
  w.wobble = 1;
  s.state = 'fly'; s.hopping = false; s.bounces = 0; s.contacted = false;
  sfx.boing();
  world.burst(tmp2.set(p.x, w.y, p.z), 0xffffff, 6);
  award(50, `${w.big ? 'BIG ' : ''}WEB BOUNCE! ×${s.mult}`, p, 'web');
}

// launch the frog from `from` so it comes down exactly on `target`
function launchTo(from, target, deg = 50) {
  const s = shot;
  const D = Math.max(0.5, hdist(from, target)), dy = target.y - from.y;
  let th = (deg * Math.PI) / 180;
  while (D * Math.tan(th) - dy < 1 && th < 1.4) th += 0.05;
  const sp = Math.sqrt((G * D * D) / (2 * Math.cos(th) ** 2 * (D * Math.tan(th) - dy)));
  const yaw = yawTo(from, target);
  s.pos.copy(from);
  s.vel.set(Math.sin(yaw) * Math.cos(th) * sp, Math.sin(th) * sp, Math.cos(yaw) * Math.cos(th) * sp);
  s.lastDir.copy(dirOf(yaw));
  s.state = 'fly'; s.hopping = false; s.bounces = 0; s.contacted = false;
}
// somewhere on the island (not in the sea) dmin..dmax away
function randomLanding(from, dmin, dmax) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
    const x = from.x + Math.sin(a) * d, z = from.z + Math.cos(a) * d;
    const h = world.height(x, z);
    if (world.surface(x, z, h) !== 'sea') return new THREE.Vector3(x, Math.max(h, 0), z);
  }
  return world.cup.clone();
}

function flyStep(dt) {
  const s = shot, p = s.pos, v = s.vel;
  const prevY = p.y;
  v.y -= G * dt;
  p.addScaledVector(v, dt);
  const cx = p.x, cy = p.y + 0.4, cz = p.z;
  checkPickups(cx, cy, cz);
  if (v.y < 0 && checkPortal()) return;
  for (const w of world.webs) {
    if (s.used.has(w) || !(prevY > w.y && p.y <= w.y && v.y < 0)) continue;
    if (inWeb(w, p.x, p.z)) { webBounce(w); return; }
  }
  for (const b of world.belts) {
    if (v.y > 0 || p.y > b.top || p.y < b.top - 1.5) continue;
    const rx = p.x - b.p1.x, rz = p.z - b.p1.z;
    const along = rx * b.dir.x + rz * b.dir.z, side = rx * b.perp.x + rz * b.perp.z;
    if (along >= 0 && along <= b.len && Math.abs(side) < b.w / 2) {
      s.state = 'belt'; s.belt = b; s.along = along; s.side = side * 0.6; s.tick = 0;
      p.y = b.top;
      sfx.belt();
      if (!s.used.has(b)) { s.used.add(b); award(50, 'CONVEYOR RIDE!', p, 'belt'); }
      return;
    }
  }
  // flying into an elephant is like hitting a tree: bonk off its side and flop to the ground
  for (const el of world.elephants) {
    const parts = [[el.pos.x, el.pos.y + 3.6, el.pos.z, 3.4],
      [el.pos.x + Math.sin(el.yaw) * 2.9, el.pos.y + 4.6, el.pos.z + Math.cos(el.yaw) * 2.9, 2.3]];
    for (const [bx, by, bz, r] of parts) {
      if (Math.hypot(cx - bx, cy - by, cz - bz) >= r) continue;
      // push straight out sideways so the frog can't perch on its back
      let dx = cx - bx, dz = cz - bz, d = Math.hypot(dx, dz);
      if (d < 0.01) { dx = -v.x; dz = -v.z; d = Math.hypot(dx, dz) || 1; }
      dx /= d; dz /= d;
      p.x = bx + dx * (r + 0.4); p.z = bz + dz * (r + 0.4);
      v.set(dx * 2.5, Math.min(v.y, 0), dz * 2.5);
      s.hopping = true; s.hopsLeft = 0;
      if (!s.used.has('bonk')) { s.used.add('bonk'); sfx.thud(); sfx.trumpet(); popup('Bonk!', p, 'note'); }
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
      award(100, 'FROG BONK!', p);
    }
  }
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
  checkMystery();
  if (checkPortal()) return;
  for (const w of world.webs) if (!s.used.has(w) && inWeb(w, p.x, p.z, 0.5)) return webBounce(w);
  const surf = world.surface(p.x, p.z, h);
  if (surf === 'pond' || surf === 'sea') { const pad = padAt(p); if (pad) return startPad(pad); }
  if (surf === 'sea') {
    s.state = 'oob'; s.timer = 1.4;
    sfx.splash();
    world.burst(tmp.set(p.x, 0.3, p.z), 0xffffff, 5);
    banner('SPLASH! Out of bounds', 'bad');
    return;
  }
  if (surf === 'pond') return startSwim();
  if (!s.contacted) { s.contacted = true; s.hopsLeft = (HOP_COUNT[surf] ?? 1) + (s.item === 'boots' ? 3 : 0); }
  // Sticky Feet: no bouncing, no hopping, stop right here
  if (s.item === 'sticky' && surf !== 'green') { p.y = h; v.set(0, 0, 0); popup('Stuck!', p, 'note'); return restHere(); }
  // ice: no bounce, no hops, the frog skids along keeping a good part of its speed
  if (surf === 'ice') {
    p.y = h;
    const keep = s.hopping ? 0.95 : 0.8;
    startSlide(true);
    s.slideV.set(v.x * keep, 0, v.z * keep);
    if (s.slideV.lengthSq() > 0.01) s.lastDir.copy(s.slideV).normalize();
    return;
  }
  if (surf === 'sand') { sfx.thud(); popup('Sand!', p, 'note'); return restHere(); }
  const n = world.normal(p.x, p.z);
  const vn = v.dot(n);
  // steep mountainside: no bouncing off it, the frog just slides down
  if (n.y < 0.86 && surf !== 'green' && (s.slides || 0) < 3) {
    p.y = h;
    startSlide();
    s.slideV.set(v.x, 0, v.z).addScaledVector(tmp.set(n.x, 0, n.z), -vn).multiplyScalar(0.3);
    return;
  }
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
    const hs = (HOP_SPEED[surf] || 2.4) * (0.45 + 0.55 * Math.min(1, s.hopsLeft / 3)) * (s.item === 'boots' ? 1.8 : 1);
    v.set(dir.x * hs, HOP_VY * (s.item === 'boots' ? 1.3 : 1), dir.z * hs);
    s.hopsLeft--;
    p.y = h + 0.02;
    sfx.hop();
    return;
  }
  restHere();
}

// The frog has stopped. Before the turn ends, anything nearby gets a go at it: the cup, a slope,
// a web, a snake, an elephant, a fly. Each can only happen once per shot, but they chain.
function restHere() {
  const s = shot, p = s.pos;
  s.state = 'fly';
  const dc = hdist(p, world.cup);
  const surf = world.surface(p.x, p.z);
  if (!s.hopIn && dc < 2.8 && surf === 'green') {
    s.hopIn = true;
    const T = (2 * HOP_VY) / G, hs = dc / T;
    s.vel.set(((world.cup.x - p.x) / dc) * hs, HOP_VY, ((world.cup.z - p.z) / dc) * hs);
    s.hopping = true; s.hopsLeft = 0;
    p.y += 0.02;
    popup('Hop in!', p, 'note');
    sfx.hop();
    return;
  }
  checkMystery();
  if (checkPortal()) return;
  if ((s.slides || 0) < 3 && surf !== 'green' && world.normal(p.x, p.z).y < 0.86) return startSlide();
  for (const w of world.webs) {
    if (!s.used.has(w) && inWeb(w, p.x, p.z, 2.5)) {
      s.vel.set(s.lastDir.x * 2, -1, s.lastDir.z * 2);
      const strong = !!s.fromWater;
      s.fromWater = false;
      return webBounce(w, strong);
    }
  }
  s.fromWater = false;
  for (const sn of world.snakes) if (!s.used.has(sn) && Math.hypot(p.x - sn.x, p.z - sn.z) < SNAKE_R) return startSnake(sn);
  for (const el of world.elephants) if (!s.used.has(el) && hdist(p, el.pos) < ELEPHANT_R) return startElephant(el);
  if (s.item !== 'sticky' && leapForFly()) return;
  finish();
}

// ---------- lily pads: spin round with the frog on board, then fling it somewhere new ----------
function padAt(p) {
  for (const pd of world.pads) if (!shot.used.has(pd) && Math.hypot(p.x - pd.x, p.z - pd.z) < pd.r + 0.4) return pd;
  return null;
}
function startPad(pd) {
  const s = shot;
  s.used.add(pd);
  s.state = 'pad'; s.pad = pd; s.et = 0;
  s.pos.set(pd.x, 0.3, pd.z);
  sfx.hop();
  award(50, 'LILY PAD SPIN!', s.pos, 'belt');
}
function padStep(dt) {
  const s = shot, pd = s.pad;
  s.et += dt;
  pd.spin = 1;
  s.pos.set(pd.x, 0.3, pd.z);
  const a = s.et * 9;
  s.lastDir.set(Math.sin(a), 0, Math.cos(a));
  if (s.et > 1.3) {
    launchTo(s.pos.clone(), randomLanding(s.pos, 20, 42), 48);
    sfx.boing();
  }
}

// ---------- whirlpool portals: spin down one, pop up out of its partner ----------
function checkPortal() {
  const s = shot, p = s.pos;
  for (const pt of world.portals) {
    if (s.used.has(pt) || Math.hypot(p.x - pt.x, p.z - pt.z) > 2.6 || p.y - pt.y > 1.4) continue;
    s.used.add(pt); s.used.add(pt.to);
    s.state = 'portal'; s.portal = pt; s.et = 0; s.warped = false;
    sfx.splash();
    award(50, 'WHIRLPOOL WARP!', p, 'web');
    return true;
  }
  return false;
}
function portalStep(dt) {
  const s = shot, pt = s.portal, frog = cur.frog.group;
  s.et += dt;
  const a = s.et * 14;
  s.lastDir.set(Math.sin(a), 0, Math.cos(a));
  if (!s.warped) {
    s.pos.x += (pt.x - s.pos.x) * Math.min(1, dt * 8);
    s.pos.z += (pt.z - s.pos.z) * Math.min(1, dt * 8);
    s.pos.y = pt.y - s.et * 0.8;
    frog.scale.setScalar(Math.max(0.05, 1 - s.et / 0.6));
    if (s.et >= 0.6) {
      const out = pt.to;
      s.pos.set(out.x, out.y - 0.4, out.z);
      s.warped = true;
      camPos.set(out.x + 9, out.y + 7, out.z + 9);   // jump the camera with the frog
      sfx.splash();
    }
  } else {
    frog.scale.setScalar(Math.min(1, (s.et - 0.6) / 0.3));
    if (s.et >= 0.9) {
      frog.scale.setScalar(1);
      const yaw = Math.random() * Math.PI * 2;
      s.vel.set(Math.sin(yaw) * 5, 10, Math.cos(yaw) * 5);
      s.lastDir.copy(dirOf(yaw));
      s.pos.y = s.portal.to.y + 0.3;
      s.state = 'fly'; s.hopping = false; s.bounces = 0; s.contacted = false;
      sfx.boing();
    }
  }
}

// ---------- "?" circles: land on one for a random backpack item ----------
function checkMystery() {
  const s = shot, p = s.pos;
  for (const m of world.mysteries) {
    if (m.used || Math.hypot(p.x - m.x, p.z - m.z) > 3 || p.y - m.y > 1.5) continue;
    m.used = true; m.t = 0;
    m.model.glow.material.opacity = 1;
    m.model.bMat.emissive.set(0xffe14d);
    const k = giveItem(cur);
    sfx.coin(); sfx.ding();
    award(50, `${ITEMS[k].icon} ${ITEMS[k].name}!`, p, 'gold');
    popup('Into the backpack!', tmp.copy(p).add(tmp2.set(0, 2, 0)), 'note');
  }
}

// After landing, a hungry frog leaps at the nearest fly in reach, flies through it and keeps
// going; when it lands again it looks for the next one, so flies chain into a combo.
const FLY_REACH = 15;
function leapForFly() {
  const s = shot, p = s.pos;
  let best = null, bd = s.item === 'goggles' ? FLY_REACH * 2 : FLY_REACH;
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

// tick(): every whole second spent doing something pays out
function perSecond(dt, pts) {
  const s = shot;
  s.tick = (s.tick || 0) + dt;
  if (s.tick >= 1) { s.tick -= 1; award(pts, '', s.pos, 'belt', false); }
}

function beltStep(dt) {
  const s = shot, b = s.belt;
  s.along += dt * 7;
  s.side *= Math.pow(0.3, dt);
  s.pos.set(b.p1.x + b.dir.x * s.along + b.perp.x * s.side, b.top, b.p1.z + b.dir.z * s.along + b.perp.z * s.side);
  s.lastDir.copy(b.dir);
  s.vel.set(b.dir.x * 7, 0, b.dir.z * 7);
  checkPickups(s.pos.x, s.pos.y + 0.4, s.pos.z);
  perSecond(dt, 10);
  if (s.along > b.len) {
    s.state = 'fly';
    s.vel.set(b.dir.x * 7, 3, b.dir.z * 7);
    s.hopping = true; s.hopsLeft = 1; s.contacted = true;
  }
}

// ---------- mountains: steep ground sends the frog sliding ----------
function startSlide(onIce = false) {
  const s = shot;
  if (!onIce) s.slides = (s.slides || 0) + 1;
  s.state = 'slide'; s.slideT = 0; s.tick = 0;
  s.slideV = new THREE.Vector3();
  const key = onIce ? 'ice' : 'slide';
  if (!s.used.has(key)) { s.used.add(key); popup(onIce ? 'Slip-sliding!' : 'Wheee!', s.pos, 'note'); }
}
function slideStep(dt) {
  const s = shot, p = s.pos, v = s.slideV;
  s.slideT += dt;
  const n = world.normal(p.x, p.z);
  const icy = world.surface(p.x, p.z) === 'ice';
  if (icy) {
    // ice: hardly any grip, so the frog glides on the way it landed and slows gradually
    v.x += n.x * G * dt * 0.3; v.z += n.z * G * dt * 0.3;
    const sp = v.length(), slowed = Math.max(0, sp - 3.5 * dt);
    v.multiplyScalar(sp > 0 ? slowed / sp : 0);
  } else if (n.y < 0.86) {
    // steep slope: gravity pulls you down it
    v.x += n.x * G * dt; v.z += n.z * G * dt;      // the normal's sideways part points downhill
    v.multiplyScalar(Math.pow(0.5, dt));
  } else {
    // ordinary snow or grass: grips and stops you fast, without rolling you back
    v.multiplyScalar(Math.pow(0.03, dt));
  }
  if (v.length() > 28) v.setLength(28);
  p.x += v.x * dt; p.z += v.z * dt;
  const h = world.height(p.x, p.z);
  if (h < 0.02) {
    p.y = 0;
    if (world.surface(p.x, p.z, h) === 'sea') { s.state = 'fly'; s.vel.set(v.x, 0, v.z); return land(h); }
    return startSwim();
  }
  p.y = h;
  if (v.lengthSq() > 0.25) s.lastDir.set(v.x, 0, v.z).normalize();
  s.vel.set(v.x, 0, v.z);
  checkPickups(p.x, p.y + 0.4, p.z);
  checkMystery();
  if (checkPortal()) return;
  for (const w of world.webs) if (!s.used.has(w) && inWeb(w, p.x, p.z)) { s.vel.set(v.x, -1, v.z); return webBounce(w); }
  const stopped = icy ? v.length() < 0.5 : n.y >= 0.86 && v.length() < 1.5;
  if (stopped || s.slideT > 12) restHere();
}

// ---------- snakes: grab, shake, throw (into a web if one is close) ----------
function startSnake(sn) {
  const s = shot;
  s.used.add(sn);
  s.state = 'snake'; s.snake = sn; s.et = 0;
  sn.grab = true; sn.shake = 0;
  let web = null, bd = 40;
  for (const w of world.webs) {
    const d = Math.hypot(w.x - sn.x, w.z - sn.z);
    if (!s.used.has(w) && d < bd) { web = w; bd = d; }
  }
  s.throwWeb = !!web;
  s.throwTarget = web ? new THREE.Vector3(web.x, web.y, web.z) : randomLanding(new THREE.Vector3(sn.x, sn.y, sn.z), 18, 40);
  sn.faceYaw = Math.atan2(s.throwTarget.x - sn.x, s.throwTarget.z - sn.z);
  sfx.trumpet();
  award(100, 'SNAKE SNATCH!', s.pos, 'gold');
}
function snakeStep(dt) {
  const s = shot, sn = s.snake;
  s.et += dt;
  sn.model.grip.getWorldPosition(tmp);
  tmp.y -= 0.4;
  s.pos.lerp(tmp, Math.min(1, dt * 12));
  if (s.et > 1.6) {
    sn.grab = false;
    launchTo(s.pos.clone(), s.throwTarget, 48);
    popup(s.throwWeb ? 'Into the web!' : 'Fling!', s.pos, 'note');
    sfx.boing();
  }
}

// ---------- elephants ----------
// Stop near one and it grabs you, rears up, counts 3-2-1-GO and you press on GO.
const GO_T = 2.9;
function startElephant(el) {
  const s = shot;
  s.used.add(el);
  s.state = 'elephant'; s.el = el; s.et = 0; s.pressT = null; s.lastCount = '';
  el.grabT = 0; el.faceYaw = null;
  sfx.trumpet();
  award(100, 'ELEPHANT!', s.pos, 'gold');
  s.cpuPress = GO_T + (Math.random() + Math.random() + Math.random() - 1.5) * 0.3;
}
function elephantStep(dt) {
  const s = shot, el = s.el;
  s.et += dt;
  el.model.tip.getWorldPosition(tmp);
  tmp.y -= 0.4;
  s.pos.lerp(tmp, Math.min(1, dt * 10));
  el.rearTarget = s.et > 0.5 ? 1 : 0;
  // countdown
  let label = '';
  if (s.et >= GO_T) label = 'GO!';
  else if (s.et >= 0.8) label = String(3 - Math.floor((s.et - 0.8) / 0.7));
  if (label !== s.lastCount) {
    s.lastCount = label;
    showCountdown(label);
    if (label) label === 'GO!' ? sfx.ding() : sfx.tick();
  }
  setPressButton(!cur.cpu && s.pressT === null && s.et >= 0.8 && s.et < GO_T + 0.9);
  if (cur.cpu && s.pressT === null && s.et >= s.cpuPress) s.pressT = s.et;
  const done = (s.pressT !== null && s.et >= Math.max(s.pressT, GO_T) + 0.3) || s.et > GO_T + 0.9;
  if (!done) return;
  setPressButton(false);
  showCountdown('');
  const err = s.pressT === null ? 9 : Math.abs(s.pressT - GO_T);
  const early = s.pressT !== null && s.pressT < GO_T;
  if (err < 0.06) award(300, 'PERFECT TIMING!', s.pos, 'gold');
  else if (err < 0.15) award(200, 'GREAT TIMING!', s.pos, 'gold');
  else if (err < 0.3) award(100, 'GOOD TIMING', s.pos, 'belt');
  else if (err < 0.45) award(30, 'OK…', s.pos, 'note');
  else award(-100, s.pressT === null ? 'TOO SLOW!' : early ? 'TOO EARLY!' : 'TOO LATE!', s.pos);
  el.rearTarget = 0; el.grabT = -1;
  // half the time it's a great throw at the hole, half the time it goes anywhere
  const from = s.pos.clone();
  if (Math.random() < 0.5) {
    const toCup = hdist(from, world.cup);
    let target = world.cup.clone();
    if (toCup > 75) target = from.clone().add(tmp.copy(world.cup).sub(from).setY(0).setLength(70));
    const a = Math.random() * Math.PI * 2, r = Math.random() * 5;
    target.x += Math.sin(a) * r; target.z += Math.cos(a) * r;
    target.y = Math.max(0, world.height(target.x, target.z));
    launchTo(from, target, 50);
    popup('Toward the hole!', from, 'note');
  } else {
    launchTo(from, randomLanding(from, 25, 55), 50);
    popup('Wild throw!', from, 'note');
  }
  sfx.boing();
}

// ---------- water: swim straight on (or ride the stream), then climb out ----------
function findShore(at) {
  for (let r = 1; r < 45; r += 1) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
      const h = world.height(x, z);
      // climb out somewhere flat, not up a steep bank you'd just slide back down
      if (h > 0.35 && world.normal(x, z).y > 0.9) { const sf = world.surface(x, z, h); if (sf !== 'pond' && sf !== 'sea') return { x, z }; }
    }
  }
  return { x: shot.rest.x, z: shot.rest.z };
}
function startSwim() {
  const s = shot, p = s.pos;
  const route = [];
  let at = { x: p.x, z: p.z };
  const dir = new THREE.Vector3(s.vel.x, 0, s.vel.z);
  if (dir.lengthSq() < 0.25) dir.copy(s.lastDir);
  dir.normalize();
  const st = world.streamAt(p.x, p.z);
  if (st) {
    // no current in rivers. If the frog is heading along the river rather than across it,
    // turn it to cross straight over to the bank on the side it was drifting toward.
    const a = st.stream.pts[st.seg], b = st.stream.pts[st.seg + 1];
    const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz);
    const ux = tx / tl, uz = tz / tl;
    if (Math.abs(dir.x * ux + dir.z * uz) > 0.8) {
      const side = dir.x * -uz + dir.z * ux >= 0 ? 1 : -1;
      dir.set(-uz * side, 0, ux * side);
    }
  }
  // no turning round: paddle straight ahead until the bank
  let exit = null;
  for (let t = 1; t < 90; t += 0.5) {
    const x = at.x + dir.x * t, z = at.z + dir.z * t, h = world.height(x, z);
    if (h > 0.3) {
      const sf = world.surface(x, z, h);
      if (sf !== 'sea' && sf !== 'pond') {
        // climb out onto flat ground a little further along the same line, so the frog doesn't
        // slide straight back down a steep bank
        for (let u = t + 1; u < t + 8; u += 0.5) {
          const ex = at.x + dir.x * u, ez = at.z + dir.z * u, eh = world.height(ex, ez);
          if (eh > 0.3 && world.normal(ex, ez).y > 0.9 && !['sea', 'pond'].includes(world.surface(ex, ez, eh))) { exit = { x: ex, z: ez }; break; }
        }
        break;
      }
    }
    if (h < 0.02 && !world.inLake(x, z)) break;          // open sea ahead: head for the nearest bank instead
  }
  route.push({ ...(exit || findShore(at)), speed: 4.5, shore: true });
  s.state = 'swim'; s.route = route; s.tick = 0; s.swimT = 0;
  sfx.splash();
  world.burst(tmp.set(p.x, 0.3, p.z), 0xffffff, 4);
  if (!s.used.has('swim')) { s.used.add('swim'); award(30, 'SPLASH! SWIM!', p, 'belt'); }
}
function swimStep(dt) {
  const s = shot, p = s.pos;
  s.swimT += dt;
  const w = s.route[0];
  const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz), step = w.speed * dt;
  if (d > 0.01) { s.lastDir.set(dx / d, 0, dz / d); s.vel.set(dx / d * w.speed, 0, dz / d * w.speed); }
  if (d <= step || s.swimT > 25) {
    p.x = w.x; p.z = w.z;
    s.route.shift();
    if (!s.route.length || s.swimT > 25) {
      p.y = Math.max(0, world.height(p.x, p.z));
      s.fromWater = true;
      return restHere();
    }
  } else {
    p.x += (dx / d) * step; p.z += (dz / d) * step;
  }
  const h = world.height(p.x, p.z);
  p.y = h > 0 ? h : -0.2 + Math.sin(s.swimT * 10) * 0.05;
  checkPickups(p.x, 0.3, p.z);
  const pad = padAt(p);
  if (pad) return startPad(pad);
  if (checkPortal()) return;
  perSecond(dt, 10);
}

function holeOut() {
  const s = shot, p = cur;
  p.holed = true;
  const bonus = HOLE_BONUS[Math.min(p.strokes, HOLE_BONUS.length - 1)];
  const label = p.strokes === 1 ? 'HOLE IN ONE!!' : p.strokes === 2 ? 'GREAT SHOT!' : 'IN THE HOLE!';
  sfx.ding();
  award(bonus, label, world.cup, 'big', false);
  if (!firstIn && players.length > 1) {
    award(200, '', tmp.copy(world.cup).add(tmp2.set(0, 2, 0)), 'gold', false);
    popup('First in!', tmp.copy(world.cup).add(tmp2.set(0, 3.5, 0)), 'note');
  }
  firstIn = true;
  cur.frog.group.visible = false; cur.shadow.visible = false;
  finish(true);
}

function finish(holed = false) {
  const s = shot;
  for (const f of world.flies) f.targeted = false;
  for (const el of world.elephants) { el.grabT = -1; el.rearTarget = 0; }
  for (const sn of world.snakes) sn.grab = false;
  if (cur.frog.group.visible) cur.frog.group.scale.setScalar(1);
  setPressButton(false); showCountdown('');
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
  } else if (!holed && s.points !== 0) {
    banner(`Shot: ${s.points > 0 ? '+' : ''}${s.points.toLocaleString()}`, s.points > 0 ? 'score' : 'bad', 1.3);
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
    if (humanBest > best) { best = humanBest; newBest = true; try { localStorage.setItem(bestKey(), String(best)); } catch { /* ignore */ } }
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
  setPressButton(false); showCountdown('');
  players.forEach(p => { p.frog.group.visible = p.shadow.visible = false; });
  renderSetup();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (shot && shot.state === 'elephant' && shot.pressT === null && !cur.cpu) { shot.pressT = shot.et; sfx.thwack(); setPressButton(false); }
    else onSwing();
  }
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
  if (snow.visible) {
    const a = snow.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 3.2;
      if (y < -5) y += 40;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(time * 0.7 + i) * dt * 0.4);
    }
    a.needsUpdate = true;
    snow.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
  }

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
    $('meterRange').textContent = `TARGET ${aimDist.toFixed(0)}m${cur.equipped ? ' ' + ITEMS[cur.equipped].icon : ''}`;
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
      if (s.state === 'fly' || s.state === 'elephant' || s.state === 'snake') {
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
  if (s.state === 'elephant') {
    const el = s.el;
    const side = tmp2.set(Math.cos(el.yaw), 0, -Math.sin(el.yaw));
    camPosT.copy(el.pos).addScaledVector(side, 16).add(tmp.set(0, 7, 0));
    camLookT.copy(el.pos).add(tmp.set(0, 4.5, 0));
    return;
  }
  if (s.state === 'snake') {
    const sn = s.snake;
    const back = dirOf(sn.faceYaw + 1.2);
    camPosT.set(sn.x, sn.y + 6, sn.z).addScaledVector(back, 11);
    camLookT.set(sn.x, sn.y + 3.5, sn.z);
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

// title backdrop: show the chosen world's first hole behind the menu
function showBackdrop() {
  if (world) { scene.remove(world.group); world.dispose(); }
  world = makeWorld(setup.world, 0);
  scene.add(world.group);
  camPos.set(30, 26, 20); camLook.set(0, 0, -60);
  camPosT.copy(camPos); camLookT.copy(camLook);
}
showBackdrop();

// test hook: lets tooling drive frames when the tab is hidden
window.__frolf = {
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); renderer.render(scene, camera); },
  get state() { return { phase, hole: holeIdx, cur: cur && cur.def.name, shot: shot && shot.state, players: players.map(p => ({ n: p.def.name, total: p.total, strokes: p.strokes, holed: p.holed })) }; },
  setAim(yaw, dist, loft) { aimYaw = yaw; if (dist != null) aimDist = dist; if (loft != null) cur.loft = loft; updateAim(); },
  aimAt(x, z) { setAimPoint(new THREE.Vector3(x, 0, z)); },
  get aim() { return { yaw: aimYaw, dist: aimDist, max: aimMax, power: aimPower, speed: meterSpeed, land: aimLand.clone() }; },
  get world() { return world; },
  goto(i) { holeIdx = i; loadHole(); },
  teleport(x, z) { cur.pos.set(x, world.height(x, z), z); beginAim(); },
  get shot() { return shot && { state: shot.state, points: shot.points, mult: shot.mult, pos: shot.pos.clone(), et: shot.et }; },
  press() { if (shot && shot.state === 'elephant') shot.pressT = shot.et; },
  map(on = true) { mapMode = on; },
};
