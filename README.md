# Frolf Island

Frog golf for your phone, inspired by *Ribbit King*. Whack the seesaw with a hammer,
launch your frog, and pile up points on the way to the cup.

Play: https://cbeaver728.github.io/frolf-island/

## How it plays

- **Aim**: put the target anywhere inside your reach (the yellow dotted circle). Tap the
  ground, or drag: sideways turns, up/down moves it farther/closer. In **MAP** view the target
  follows your finger.
- **Angle**: LOW rolls farther, MID is the all-rounder, HIGH stops quickly.
- **Power**: tap SWING to start the bar, tap HIT! as it reaches the end. A full bar lands
  exactly on the target ("PERFECT!" from 97%); stopping early comes up short. The farther the
  target, the faster the bar runs.
- **Flies**: once the frog lands it leaps at any fly within 15 m, keeps going, lands, and leaps
  at the next one, so a swarm chains into a big combo.
- **Spider webs** lie on the ground. Landing on or near one always bounces you high and
  **doubles** every point for the rest of the shot. Some sit at the end of conveyor belts.
- **Snakes** pop in and out of holes. Stop near one and it grabs you, shakes, and throws you,
  straight into a web if there's one within 40 m.
- **Elephants**: fly into one and you bonk off it like a tree. Stop near one and it rears
  up with a 3-2-1-GO countdown: press on GO for up to +600, or lose 200 for bad timing. Then
  it throws you, half the time at the hole and half the time anywhere.
- **Water** is good: swim for +50 every second, grab the bubbles floating on lakes, and ride
  streams with the current. Belts pay +30 a second.
- **Mountains** have steep sides you slide down (no points) and treasure bubbles (3 × 300) on top.
- When the frog stops, anything nearby gets a go at it: hop into the cup, slide, web, snake,
  elephant, then leap at flies. Everything chains into one combo (up to ×3).
- **Holes are arenas**, so the points are out to the sides. Hole-out bonus by strokes:
  1500 / 800 / 500 / 350 / 250 ... and +300 for the first frog in. 8 strokes max per hole.
- **Turns** go strictly in rotation, one stroke each, no matter who is ahead. You only go twice
  in a row once everyone else has holed out. The first player rotates each hole.
- 1-4 players, each a person (pass the phone) or CPU. The CPU weighs gimmicks against getting
  home, and cares more about the cup the more strokes it has taken.

## Code

Zero build step: plain ES modules plus a vendored `three.module.min.js` (r170).

- `src/holes.js` - arena layouts (land circles, lakes, streams, mountains, webs, belts,
  elephants, snakes) as plain data.
- `src/world.js` - heightfield terrain, surfaces, trees, bubbles, gimmick animation.
- `src/main.js` - turns, aiming, power meter, flight physics, scoring, camera, HUD.
- `src/models.js` - every model, built from primitives.
- `src/audio.js` - synthesized sound effects.

Local preview: `node tools/serve.js 8160`. `window.__frolf.step(n)` advances frames
by hand (useful when the tab is in the background), `__frolf.goto(i)` jumps to a hole, `__frolf.teleport(x, z)` moves the current frog.

Pushes to `main` deploy to GitHub Pages.
