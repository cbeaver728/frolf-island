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
    path: [[0, 0], [10, -150]],
    land: [[0, -10, 32], [0, -69, 62], [6, -144, 40], [-56, -88, 30], [56, -62, 32], [-50, -135, 26], [55, -125, 24]],
    ponds: [[-45, -78, 16, 12], [52, -122, 9, 7]],
    streams: [{ w: 5, pts: [[-62, -122], [-42, -130], [-24, -118], [-14, -100]] }],
    mountains: [[52, -58, 18, 12]],
    hills: [[-25, -19, 12, 2]],
    bunkers: [[28, -148, 4]],
    webs: [[-22, -38, 0.3], [-6, -128, 0.2], [30, -110, 0], [20, -30, 0.5], [-42, -110, 0], [45, -96, 0.3]],
    snakes: [[-30, -104], [38, -28], [-56, -142]],
    elephants: [[8, -78, 24, -88]],
  },
  {
    name: 'Web Wonderland',
    path: [[0, 0], [0, -175]],
    land: [[0, -10, 32], [0, -88, 65], [0, -172, 38], [-60, -112, 32], [60, -98, 32], [-55, -40, 24], [55, -158, 24], [55, -55, 22], [-50, -150, 22]],
    streams: [
      { w: 6, pts: [[65, -52], [52, -78], [35, -100], [18, -122], [10, -138]] },
      { w: 5, pts: [[-72, -118], [-56, -140], [-32, -150]] },
    ],
    ponds: [[8, -142, 9, 6], [-55, -38, 10, 8]],
    bunkers: [[16, -180, 4]],
    webs: [[-28, -55, 0], [20, -60, 0.4], [-42, -112, 0], [40, -128, 0.6], [-5, -95, 0.2], [-18, -148, 0.3],
      [12, -32, 0.3], [25, -160, 0], [-30, -78, 0.5]],
    snakes: [[-58, -96], [55, -118], [0, -120], [-44, -55]],
    elephants: [[-12, -65, -20, -80]],
    hills: [[-36, -22, 12, 2.5]],
  },
  {
    name: 'Belt Bay',
    path: [[0, 0], [75, -162]],
    land: [[0, -10, 32], [12, -75, 60], [69, -150, 42], [-38, -115, 32], [78, -75, 30], [-45, -50, 24], [20, -150, 26], [-12, -150, 22], [92, -60, 20], [90, -100, 20]],
    belts: [[-12, -38, -38, -88, 5, true], [31, -88, 60, -125, 5, true], [78, -62, 80, -115, 4.5, false],
      [8, -128, 33, -150, 5, true]],
    ponds: [[-40, -132, 15, 11], [-48, -48, 9, 7]],
    streams: [{ w: 5, pts: [[90, -50], [95, -78], [88, -100]] }],
    snakes: [[38, -50], [-20, -102], [55, -100]],
    webs: [[-14, -150, 0], [40, -40, 0.5], [-5, -75, 0.2]],
    elephants: [[20, -45, 6, -55]],
    bunkers: [[91, -158, 4]],
    hills: [[0, -82, 14, 3]],
  },
  {
    name: 'Mammoth Meadow',
    path: [[0, 0], [-25, -188]],
    land: [[0, -10, 32], [0, -88, 68], [-25, -180, 40], [56, -125, 35], [-65, -78, 32], [60, -50, 24], [-70, -150, 26], [-80, -110, 18]],
    elephants: [[19, -62, 6, -88], [-31, -128, -10, -138], [50, -115, 60, -138], [-80, -150, -70, -165]],
    mountains: [[-55, -75, 20, 14]],
    streams: [
      { w: 5, pts: [[-82, -112], [-60, -124], [-44, -146]] },
      { w: 5, pts: [[58, -54], [48, -70], [36, -86]] },
    ],
    ponds: [[12, -122, 9, 7], [62, -46, 8, 6]],
    webs: [[-10, -100, 0], [-5, -158, 0], [-35, -38, 0.3], [40, -100, 0.4], [-2, -140, 0]],
    snakes: [[35, -140], [-30, -100], [25, -40]],
    bunkers: [[-40, -200, 4]],
  },
  {
    name: 'Splash Isle',
    path: [[0, 0], [0, -156]],
    land: [[0, -10, 32], [0, -75, 58], [0, -156, 40], [-52, -110, 30], [50, -110, 28], [-50, -40, 22], [50, -40, 22]],
    moats: [[0, -156, 18, 32]],
    belts: [[0, -102, 0, -138, 5, false]],
    streams: [
      { w: 6, pts: [[-48, -45], [-38, -72], [-38, -102], [-20, -132]] },
      { w: 5, pts: [[42, -48], [45, -75], [35, -100], [18, -132]] },
    ],
    ponds: [[46, -36, 10, 8]],
    mountains: [[-58, -115, 15, 11]],
    webs: [[28, -78, 0], [-10, -60, 0.3], [42, -125, 0], [-25, -30, 0.4], [10, -40, 0], [-22, -88, 0.2]],
    snakes: [[52, -100], [-40, -130], [20, -22]],
    elephants: [[-12, -80, 8, -85]],
  },
  {
    name: 'Grand Frolf Arena',
    path: [[0, 0], [0, -215]],
    land: [[0, -10, 35], [0, -100, 75], [0, -206, 42], [-70, -150, 38], [70, -150, 38], [-62, -50, 30], [62, -50, 30], [45, -190, 22]],
    mountains: [[0, -115, 25, 16]],
    streams: [
      { w: 6, pts: [[25, -132], [42, -142], [55, -165], [48, -188]] },
      { w: 6, pts: [[-25, -135], [-45, -150], [-60, -175]] },
    ],
    ponds: [[42, -195, 11, 8], [-52, -50, 12, 10], [-63, -183, 10, 8]],
    webs: [[-32, -75, 0], [38, -72, 0.4], [-80, -140, 0], [25, -175, 0.2], [60, -110, 0], [-15, -185, 0.3], [0, -40, 0]],
    belts: [[-60, -88, -62, -130, 5, true], [55, -80, 75, -115, 5, true]],
    elephants: [[72, -140, 80, -158], [-20, -60, -35, -62], [20, -188, 30, -172]],
    snakes: [[-28, -155], [35, -92], [-40, -110], [50, -35]],
    bunkers: [[-15, -222, 4], [15, -225, 3.5]],
  },
];
