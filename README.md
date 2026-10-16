# Frolf Island

Frog golf for your phone, inspired by *Ribbit King*. Whack the seesaw with a hammer,
launch your frog, and pile up points on the way to the cup.

Play: https://cbeaver728.github.io/frolf-island/

## How it plays

- **Aim** by dragging left/right or tapping the ground. **MAP** shows the whole hole.
- **Angle**: LOW rolls farther, MID is the all-rounder, HIGH stops quickly.
- **Power**: tap SWING, watch the target slide out, tap HIT!
- **Points**: bubbles (+10 to +300), flies (+50), conveyor rides (+100), swimming out of
  ponds (+100), frog bonks (+150), elephant tosses (+500). Each extra gimmick in one shot
  raises the combo (up to x3).
- **Spider webs** are trampolines that **double** every point for the rest of the shot,
  including the hole-out bonus.
- **Hole-out bonus** by strokes: 3000 / 1500 / 1000 / 700 / 500 ... and +500 for the first
  frog in. Most points after all holes wins. 8 strokes max per hole.
- 1-4 players, each a person (pass the phone) or CPU.

## Code

Zero build step: plain ES modules plus a vendored `three.module.min.js` (r170).

- `src/holes.js` - hole layouts (paths, ponds, webs, belts, elephants) as plain data.
- `src/world.js` - heightfield terrain, surfaces, trees, bubbles, gimmick animation.
- `src/main.js` - turns, aiming, power meter, flight physics, scoring, camera, HUD.
- `src/models.js` - every model, built from primitives.
- `src/audio.js` - synthesized sound effects.

Local preview: `node tools/serve.js 8160`. `window.__frolf.step(n)` advances frames
by hand (useful when the tab is in the background), `__frolf.goto(i)` jumps to a hole.

Pushes to `main` deploy to GitHub Pages.
