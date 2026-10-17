// Hole layouts: open arenas, not fairways. The fastest line to the cup is rarely the best one;
// the points are out to the sides in lakes, streams, webs, snakes, elephants and mountain tops.
// Coordinates are metres on the ground plane: [x, z].
//
// path:      tee → cup (first point is the tee, last is the cup); the CPU uses it as its "safe line"
// land:      [x, z, radius]                 circles whose blobby union is the island
// bunkers:   [x, z, radius]
// ponds:     [x, z, radiusX, radiusZ]       lakes: frogs swim (points every second) and grab bubbles
// moats:     [x, z, innerR, outerR]         a ring of water (island greens)
// streams:   { w, pts: [[x, z], ...] }      water channels; the current carries frogs from first to last point
// hills:     [x, z, radius, height]         gentle bumps
// mountains: [x, z, radius, height]         steep sides you slide down, flat top with big bubbles
// webs:      [x, z, angle]                  spider-web trampolines on the ground: bounce + double points
// belts:     [x1, z1, x2, z2, width, web]   conveyor belts from 1 to 2; web=true puts a web at the end
// elephants: [x1, z1, x2, z2]               wander between two points
// snakes:    [x, z]                         pop out of a hole; land near one and it throws you
// groves:    [x, z, radius]                 extra clumps of palms

export const HOLES = [
  {
    name: 'Lily Lagoon',
    path: [[0, 0], [8, -120]],
    land: [[0, -8, 26], [0, -55, 50], [5, -115, 32], [-45, -70, 24], [45, -50, 26]],
    ponds: [[-36, -62, 13, 10]],
    mountains: [[42, -46, 15, 10]],
    hills: [[-20, -15, 10, 2]],
    bunkers: [[22, -118, 4]],
    webs: [[-18, -30, 0.3], [-6, -102, 0.2], [24, -88, 0]],
    snakes: [[-26, -86]],
    groves: [[45, -92, 9]],
  },
  {
    name: 'Web Wonderland',
    path: [[0, 0], [0, -140]],
    land: [[0, -8, 26], [0, -70, 52], [0, -138, 30], [-48, -90, 26], [48, -78, 26]],
    streams: [{ w: 6, pts: [[52, -42], [42, -62], [28, -80], [14, -98], [8, -110]] }],
    ponds: [[6, -114, 7, 5]],
    bunkers: [[13, -142, 4]],
    webs: [[-22, -40, 0], [16, -48, 0.4], [-34, -92, 0], [32, -102, 0.6], [-4, -76, 0.2], [-14, -118, 0.3]],
    snakes: [[-46, -78], [44, -94]],
    hills: [[-30, -20, 12, 2.5]],
  },
  {
    name: 'Belt Bay',
    path: [[0, 0], [60, -130]],
    land: [[0, -8, 26], [10, -60, 48], [55, -120, 34], [-30, -92, 26], [62, -60, 24]],
    belts: [[-10, -30, -30, -70, 5, true], [25, -70, 48, -100, 5, true], [62, -50, 64, -92, 4.5, false]],
    ponds: [[-32, -104, 12, 9]],
    snakes: [[30, -40]],
    webs: [[-14, -118, 0], [40, -28, 0.5]],
    bunkers: [[73, -124, 4]],
    hills: [[0, -60, 12, 3]],
  },
  {
    name: 'Mammoth Meadow',
    path: [[0, 0], [-20, -150]],
    land: [[0, -8, 26], [0, -70, 55], [-20, -145, 32], [45, -100, 28], [-52, -62, 25]],
    elephants: [[15, -50, 5, -70], [-25, -102, -8, -110], [40, -92, 48, -110]],
    mountains: [[-44, -60, 16, 12]],
    streams: [{ w: 5, pts: [[-64, -92], [-46, -100], [-34, -118]] }],
    webs: [[-8, -80, 0], [20, -128, 0]],
    snakes: [[32, -124]],
    bunkers: [[-32, -160, 4]],
  },
  {
    name: 'Splash Isle',
    path: [[0, 0], [0, -125]],
    land: [[0, -8, 26], [0, -60, 46], [0, -125, 32], [-42, -88, 24], [40, -88, 22]],
    moats: [[0, -125, 15, 26]],
    belts: [[0, -82, 0, -111, 5, false]],
    streams: [{ w: 6, pts: [[-38, -36], [-30, -58], [-30, -82], [-16, -106]] }],
    ponds: [[28, -40, 10, 8]],
    mountains: [[-46, -92, 12, 9]],
    webs: [[22, -62, 0], [-8, -48, 0.3], [34, -100, 0]],
    snakes: [[40, -80]],
  },
  {
    name: 'Grand Frolf Arena',
    path: [[0, 0], [0, -172]],
    land: [[0, -8, 28], [0, -80, 60], [0, -165, 34], [-56, -120, 30], [56, -120, 30], [-50, -40, 24], [50, -40, 24]],
    mountains: [[0, -92, 20, 14]],
    streams: [{ w: 6, pts: [[20, -104], [34, -114], [44, -132], [38, -150]] }],
    ponds: [[34, -155, 9, 7], [-42, -40, 10, 8]],
    webs: [[-26, -60, 0], [30, -58, 0.4], [-46, -128, 0], [20, -140, 0.2]],
    belts: [[-48, -70, -50, -104, 5, true]],
    elephants: [[58, -96, 64, -110]],
    snakes: [[-36, -144], [28, -74]],
    bunkers: [[-12, -178, 4], [12, -180, 3.5]],
  },
];
