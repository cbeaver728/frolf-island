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
// portals:   [x1, z1, x2, z2]               a pair of whirlpools: in one, out the other
// mystery:   [x, z]                         "?" circles: land on one for a random backpack item
// (webs take an optional 4th value: true = a big web, twice the size, that launches farther)
// (every lake gets lily pads automatically)
// groves:    [x, z, radius]                 extra clumps of palms
// webChains: [x, z, heading, count, gap]    a line of webs; each one tosses the frog onto the next
// tornados:  [x, z, wanderRadius]           spinning twisters that wander about and fling frogs
// trains:    { pts: [[x, z], ...], cars }   a train looping its track; every car carries a big balloon
// plateaus:  [x, z, radius, height]         raised flat ground with cliff edges
// waterfalls:[x1, z1, x2, z2, width]        a fall from (x1,z1) at the top to (x2,z2) at the bottom
// chasms:    [x1, z1, x2, z2, width]        a gap of open water: fall in and it's out of bounds
// (platforms work anywhere: in a chasm they're stepping stones)

export const HOLES = [
  {
    name: 'Lily Lagoon',
    path: [[0, 0], [52, -58]],
    webChains: [[15, -24, Math.PI, 3, 12]],
    tornados: [[-10, -110, 10]],
    land: [[0, -10, 32], [0, -69, 62], [6, -144, 40], [-56, -88, 30], [56, -62, 32], [-50, -135, 26], [55, -125, 24]],
    ponds: [[-45, -78, 16, 12], [52, -122, 9, 7], [-15, -60, 10, 7]],
    streams: [{ w: 5, pts: [[-62, -122], [-42, -130], [-24, -118], [-14, -100]] }],
    mountains: [[52, -58, 18, 12]],
    hills: [[-25, -19, 12, 2]],
    bunkers: [[28, -148, 4]],
    webs: [[-22, -38, 0.3], [-6, -128, 0.2], [30, -110, 0], [-42, -110, 0], [45, -96, 0.3],
      [10, -100, 0, true], [-30, -25, 0.4]],
    snakes: [[-30, -104], [38, -28], [-56, -142]],
    elephants: [[8, -78, 24, -88]],
    portals: [[-45, -78, 52, -122]],
    mystery: [[25, -45], [-20, -140]],
  },
  {
    name: 'Web Wonderland',
    webChains: [[-20, -25, Math.PI, 3, 12], [45, -100, Math.PI, 3, 13]],
    tornados: [[0, -100, 12]],
    path: [[0, 0], [0, -175]],
    land: [[0, -10, 32], [0, -88, 65], [0, -172, 38], [-60, -112, 32], [60, -98, 32], [-55, -40, 24], [55, -158, 24], [55, -55, 22], [-50, -150, 22]],
    streams: [
      { w: 6, pts: [[65, -52], [52, -78], [35, -100], [18, -122], [10, -138]] },
      { w: 5, pts: [[-72, -118], [-56, -140], [-32, -150]] },
    ],
    ponds: [[8, -142, 9, 6], [-55, -38, 10, 8], [30, -40, 9, 7], [-25, -130, 8, 6]],
    bunkers: [[16, -180, 4]],
    webs: [[-28, -55, 0], [20, -60, 0.4], [-42, -112, 0], [-5, -95, 0.2], [-18, -148, 0.3],
      [12, -32, 0.3], [25, -160, 0], [-30, -78, 0.5], [0, -60, 0, true]],
    snakes: [[-58, -96], [55, -118], [0, -120], [-44, -55]],
    portals: [[30, -40, -25, -130]],
    mystery: [[-40, -75], [35, -150]],
    elephants: [[-12, -65, -20, -80]],
    hills: [[-36, -22, 12, 2.5]],
  },
  {
    name: 'Belt Bay',
    webChains: [[-5, -15, 2.6, 3, 12]],
    tornados: [[20, -128, 9]],
    path: [[0, 0], [75, -162]],
    land: [[0, -10, 32], [12, -75, 60], [69, -150, 42], [-38, -115, 32], [78, -75, 30], [-45, -50, 24], [20, -150, 26], [-12, -150, 22], [92, -60, 20], [90, -100, 20]],
    belts: [[-12, -38, -38, -88, 5, true], [31, -88, 60, -125, 5, true], [78, -62, 80, -115, 4.5, false],
      [8, -128, 33, -150, 5, true]],
    ponds: [[-40, -132, 15, 11], [-48, -48, 9, 7], [10, -100, 9, 7]],
    streams: [{ w: 5, pts: [[90, -50], [95, -78], [88, -100]] }],
    snakes: [[38, -50], [-20, -102], [55, -100]],
    webs: [[-14, -150, 0], [40, -40, 0.5], [-5, -75, 0.2], [-25, -20, 0.3, true]],
    portals: [[-40, -132, 10, -100]],
    mystery: [[60, -150], [-45, -75]],
    elephants: [[20, -45, 6, -55]],
    bunkers: [[91, -158, 4]],
    hills: [[0, -82, 14, 3]],
  },
  {
    name: 'Mammoth Meadow',
    path: [[0, 0], [-25, -188]],
    plateaus: [[-25, -180, 24, 7]],
    waterfalls: [[-13.7, -168.7, -6.6, -161.6, 5]],
    webChains: [[-20, -22, Math.PI, 3, 10]],
    land: [[0, -10, 32], [0, -88, 68], [-25, -180, 40], [56, -125, 35], [-65, -78, 32], [60, -50, 24], [-70, -150, 26], [-80, -110, 18]],
    elephants: [[19, -62, 6, -88], [-31, -128, -10, -138], [50, -115, 60, -138], [-80, -150, -70, -165]],
    mountains: [[-55, -75, 20, 14]],
    streams: [
      { w: 5, pts: [[-82, -112], [-60, -124], [-44, -146]] },
      { w: 5, pts: [[58, -54], [48, -70], [36, -86]] },
    ],
    ponds: [[12, -122, 9, 7], [62, -46, 8, 6], [-20, -60, 9, 7], [-2, -157, 6, 5]],
    webs: [[-10, -100, 0], [12, -148, 0], [-35, -38, 0.3], [32, -98, 0.4, true], [-2, -140, 0]],
    portals: [[-20, -60, 62, -46]],
    mystery: [[-15, -175], [45, -80]],
    snakes: [[35, -140], [-30, -100], [25, -40]],
  },
  {
    name: 'Splash Isle',
    chasms: [[-55, -26, 30, -26, 9]],
    platforms: [[-15, -26, 3.5], [12, -26, 3.5]],
    path: [[0, 0], [0, -156]],
    land: [[0, -10, 32], [0, -75, 58], [0, -156, 40], [-52, -110, 30], [50, -110, 28], [-50, -40, 22], [50, -40, 22]],
    moats: [[0, -156, 18, 32]],
    belts: [[0, -102, 0, -138, 5, false]],
    streams: [
      { w: 6, pts: [[-48, -45], [-38, -72], [-38, -102], [-20, -132]] },
      { w: 5, pts: [[42, -48], [45, -75], [35, -100], [18, -132]] },
    ],
    ponds: [[46, -36, 10, 8], [25, -60, 8, 6]],
    mountains: [[-58, -115, 15, 11]],
    webs: [[28, -78, 0], [-10, -60, 0.3], [42, -125, 0], [-20, -10, 0.4, true], [10, -42, 0], [-22, -88, 0.2]],
    portals: [[46, -36, 0, -182]],
    mystery: [[-30, -45], [15, -120]],
    snakes: [[52, -100], [-40, -130], [25, -8]],
    elephants: [[-12, -80, 8, -85]],
  },
  {
    name: 'Grand Frolf Arena',
    trains: [{ pts: [[36, -115], [26, -140], [0, -152], [-26, -140], [-36, -115], [-26, -90], [0, -78], [26, -90]], cars: 3 }],
    tornados: [[-40, -60, 10], [42, -165, 9]],
    path: [[0, 0], [0, -215]],
    land: [[0, -10, 35], [0, -100, 75], [0, -206, 42], [-70, -150, 38], [70, -150, 38], [-62, -50, 30], [62, -50, 30], [45, -190, 22]],
    mountains: [[0, -115, 25, 16]],
    streams: [
      { w: 6, pts: [[25, -132], [42, -142], [55, -165], [48, -188]] },
      { w: 6, pts: [[-25, -135], [-45, -150], [-60, -175]] },
    ],
    ponds: [[42, -195, 11, 8], [-52, -50, 12, 10], [-63, -183, 10, 8], [30, -50, 9, 7], [-28, -205, 8, 6]],
    webs: [[-32, -75, 0], [38, -72, 0.4], [-80, -140, 0], [25, -175, 0.2], [60, -110, 0], [-15, -185, 0.3], [0, -40, 0],
      [20, -60, 0, true]],
    portals: [[30, -50, -28, -205], [-63, -183, 42, -195]],
    mystery: [[-20, -160], [60, -130]],
    belts: [[-60, -88, -62, -130, 5, true], [55, -80, 75, -115, 5, true]],
    elephants: [[72, -140, 80, -158], [-20, -60, -35, -62], [20, -188, 30, -172]],
    snakes: [[-28, -155], [35, -92], [-40, -110], [50, -35]],
    bunkers: [[-15, -222, 4], [15, -225, 3.5]],
  },
];

// ---------- Ice World ----------
// Same arena format, plus:
// ice:   [x, z, radiusX, radiusZ]   sheets of ice on land: frogs slip and slide across them
// ponds take an optional 5th value: true = frozen over (an ice rink you slide on, not water)
export const ICE_HOLES = [
  {
    name: 'Frosty Flats',
    webChains: [[-15, -50, Math.PI, 3, 12]],
    tornados: [[0, -112, 12]],
    path: [[0, 0], [0, -150]],
    land: [[0, -10, 32], [0, -70, 62], [0, -145, 40], [-55, -90, 28], [55, -80, 28], [45, -120, 24]],
    ice: [[0, -75, 22, 14], [-40, -40, 12, 8]],
    ponds: [[-50, -95, 12, 9, true], [45, -110, 10, 8], [30, -40, 8, 6, true]],
    mountains: [[50, -75, 15, 11]],
    webs: [[-20, -30, 0.3], [20, -120, 0], [-30, -120, 0.4, true], [25, -60, 0]],
    snakes: [[-35, -60], [40, -130]],
    elephants: [[-10, -110, 10, -118]],
    portals: [[-50, -95, 45, -110], [15, -25, -25, -140]],
    mystery: [[30, -28], [-15, -165]],
  },
  {
    name: 'Glacier Gulch',
    chasms: [[-55, -125, 55, -125, 8]],
    platforms: [[-15, -125, 3.5], [15, -125, 3.5]],
    tornados: [[30, -40, 8]],
    path: [[0, 0], [20, -170]],
    land: [[0, -10, 32], [0, -85, 64], [20, -168, 38], [-60, -100, 30], [60, -110, 30], [-50, -40, 22], [-30, -150, 22]],
    ice: [[-10, -90, 14, 30], [45, -150, 10, 8]],
    streams: [{ w: 6, pts: [[-70, -80], [-50, -110], [-30, -140], [-10, -150]] }],
    ponds: [[-50, -40, 10, 8, true], [55, -95, 11, 9], [30, -60, 8, 6]],
    mountains: [[65, -130, 14, 11]],
    webs: [[20, -35, 0.3], [-35, -70, 0], [30, -145, 0.4], [0, -108, 0, true], [-25, -25, 0]],
    snakes: [[-30, -100], [45, -70], [5, -60]],
    elephants: [[20, -100, 30, -115], [-60, -120, -70, -105]],
    portals: [[30, -60, -50, -40], [10, -30, 40, -150]],
    mystery: [[-45, -75], [40, -50]],
  },
  {
    name: 'Snowball Slopes',
    plateaus: [[-20, -160, 24, 8]],
    waterfalls: [[-8.7, -148.7, -1.6, -141.6, 5]],
    webChains: [[20, -25, 3.6, 3, 12]],
    path: [[0, 0], [-20, -165]],
    land: [[0, -10, 32], [0, -80, 62], [-20, -160, 38], [55, -100, 30], [-55, -70, 28], [50, -40, 24]],
    mountains: [[30, -60, 16, 13], [-35, -110, 15, 12]],
    ice: [[0, -120, 14, 10], [-45, -60, 10, 8]],
    ponds: [[50, -100, 11, 8], [-5, -60, 8, 6, true], [45, -35, 8, 6], [3, -138, 7, 5, true]],
    belts: [[-15, -25, -25, -55, 5, true]],
    webs: [[20, -110, 0], [15, -122, 0.3], [50, -125, 0, true]],
    snakes: [[10, -95], [-50, -90], [35, -25]],
    elephants: [[60, -80, 70, -95], [-15, -80, -30, -85]],
    portals: [[50, -100, -45, -60], [25, -20, -40, -135]],
    mystery: [[0, -40], [10, -148]],
  },
  {
    name: 'Mammoth Tundra',
    trains: [{ pts: [[-25, -130], [0, -122], [25, -130], [28, -150], [0, -158], [-25, -150]], cars: 3 }],
    webChains: [[10, -30, Math.PI, 3, 12]],
    path: [[0, 0], [25, -185]],
    land: [[0, -10, 32], [0, -88, 68], [25, -180, 40], [-65, -120, 30], [62, -60, 28], [-60, -40, 24], [-25, -150, 24]],
    elephants: [[-20, -60, -5, -75], [30, -110, 45, -125], [-55, -120, -70, -130], [50, -50, 62, -65]],
    ice: [[0, -140, 16, 10], [-30, -95, 10, 14]],
    ponds: [[20, -60, 9, 7, true], [-60, -40, 10, 8]],
    streams: [{ w: 5, pts: [[-75, -110], [-55, -140], [-30, -160]] }],
    webs: [[-40, -70, 0], [42, -152, 0, true], [-10, -112, 0.2]],
    snakes: [[35, -90], [-45, -140], [-35, -45]],
    portals: [[-60, -40, 45, -170]],
    mystery: [[55, -90], [-35, -135]],
  },
  {
    name: 'Frozen Lake Isle',
    tornados: [[0, -80, 14]],
    webChains: [[30, -28, Math.PI, 3, 12]],
    path: [[0, 0], [0, -158]],
    land: [[0, -10, 32], [0, -75, 60], [0, -156, 40], [-52, -110, 30], [52, -110, 30], [-50, -40, 22], [50, -40, 22]],
    moats: [[0, -158, 18, 32]],
    ponds: [[0, -80, 24, 14, true], [-45, -110, 10, 8], [45, -40, 8, 6]],
    belts: [[0, -104, 0, -140, 5, false]],
    webs: [[30, -75, 0], [-30, -70, 0.3], [40, -125, 0], [-20, -25, 0.4, true]],
    snakes: [[50, -100], [-45, -125]],
    elephants: [[-30, -45, -15, -50]],
    portals: [[45, -40, 0, -185], [25, -20, -40, -90]],
    mystery: [[25, -110], [-25, -100]],
  },
  {
    name: 'Blizzard Peak',
    tornados: [[-40, -70, 10], [40, -172, 10]],
    webChains: [[-55, -95, Math.PI, 3, 13]],
    path: [[0, 0], [0, -215]],
    land: [[0, -10, 35], [0, -100, 75], [0, -206, 42], [-70, -150, 38], [70, -150, 38], [-62, -50, 30], [62, -50, 30], [45, -180, 24]],
    mountains: [[0, -115, 25, 17]],
    ice: [[-40, -70, 14, 10], [40, -175, 14, 10], [35, -80, 10, 8]],
    streams: [{ w: 6, pts: [[-25, -135], [-45, -150], [-60, -175]] }],
    ponds: [[-63, -183, 10, 8], [52, -50, 12, 10, true], [-50, -40, 10, 8], [45, -140, 10, 8, true]],
    webs: [[-32, -95, 0], [38, -110, 0.4], [-80, -140, 0], [25, -185, 0.2, true], [0, -40, 0], [-15, -180, 0.3]],
    belts: [[60, -80, 75, -115, 5, true]],
    elephants: [[72, -140, 80, -158], [-20, -60, -35, -62], [20, -188, 30, -172]],
    snakes: [[-28, -155], [35, -92], [-40, -110], [50, -30]],
    portals: [[52, -50, -63, -183], [-25, -25, 30, -205]],
    mystery: [[-20, -160], [60, -130]],
  },
];

// ---------- Lava World ----------
// Same arena format, plus:
// lava:       [x, z, radiusX, radiusZ]    pools of lava: land in one and it costs points while your
//                                          frog hops about until it's out
// lavaRivers: { w, pts: [[x, z], ...] }   lava channels
// lavaRings:  [x, z, innerR, outerR]      a ring of lava (around a green)
// platforms:  [x, z, radius]              rock islands in the lava, loaded with big bubbles
// (ponds here are hot springs: normal water)
export const LAVA_HOLES = [
  {
    name: 'Ember Fields',
    webChains: [[18, -24, Math.PI, 3, 12]],
    tornados: [[-10, -118, 10]],
    path: [[0, 0], [5, -150]],
    land: [[0, -10, 32], [0, -70, 62], [5, -145, 40], [-55, -90, 28], [55, -80, 28], [45, -115, 22]],
    lava: [[0, -75, 20, 10], [-45, -40, 10, 7]],
    platforms: [[0, -75, 4]],
    ponds: [[45, -110, 9, 7]],
    mountains: [[-50, -95, 14, 11]],
    webs: [[-25, -30, 0.3], [25, -120, 0], [30, -50, 0]],
    snakes: [[-30, -112], [32, -35]],
    elephants: [[15, -110, 25, -100]],
    portals: [[45, -110, -20, -130]],
    mystery: [[33, -75], [-15, -160]],
  },
  {
    name: 'Magma River',
    webChains: [[-50, -68, Math.PI, 2, 48]],
    path: [[0, 0], [15, -170]],
    land: [[0, -10, 32], [0, -85, 64], [15, -168, 38], [-60, -100, 30], [60, -110, 30], [-50, -40, 22], [-40, -135, 22], [50, -140, 22]],
    lavaRivers: [{ w: 8, pts: [[-75, -90], [-30, -95], [10, -80], [50, -100], [75, -95]] }],
    platforms: [[-30, -95, 3.5], [50, -100, 3.5]],
    belts: [[0, -58, 12, -104, 5, false]],
    ponds: [[30, -40, 8, 6]],
    webs: [[-20, -40, 0.3], [30, -140, 0], [-40, -130, 0.4, true]],
    snakes: [[-40, -60], [45, -60], [0, -130]],
    elephants: [[-45, -120, -55, -110]],
    portals: [[30, -40, -5, -145]],
    mystery: [[-50, -40], [50, -140]],
  },
  {
    name: 'Volcano Peak',
    path: [[0, 0], [20, -78]],
    waterfalls: [[26.4, -82.7, 36.9, -90.4, 4]],
    webChains: [[-20, -30, 3.4, 3, 12]],
    land: [[0, -10, 32], [0, -80, 62], [-20, -160, 38], [55, -100, 30], [-55, -70, 28], [50, -40, 24]],
    mountains: [[20, -78, 20, 16]],
    lava: [[-30, -115, 14, 9], [50, -100, 9, 7], [41, -93, 6, 5]],
    platforms: [[-30, -115, 3.5]],
    ponds: [[-45, -60, 8, 6]],
    belts: [[-5, -95, -10, -135, 5, true]],
    webs: [[-10, -40, 0.3], [5, -150, 0], [45, -60, 0.4, true]],
    snakes: [[-25, -80], [35, -120], [30, -30]],
    elephants: [[-12, -150, 2, -140]],
    portals: [[-45, -60, 10, -150]],
    mystery: [[60, -80], [-40, -150]],
  },
  {
    name: 'Obsidian Isles',
    tornados: [[-40, -150, 8]],
    webChains: [[-15, -30, 3.3, 3, 12]],
    path: [[0, 0], [0, -170]],
    land: [[0, -10, 32], [0, -85, 66], [0, -168, 38], [-62, -100, 28], [62, -100, 28], [-35, -140, 22], [45, -140, 22]],
    lava: [[0, -95, 34, 22]],
    platforms: [[-15, -88, 4], [12, -98, 4.5], [0, -110, 3.5], [-22, -106, 3]],
    ponds: [[-50, -50, 9, 7], [50, -140, 8, 6]],
    webs: [[30, -50, 0], [-35, -140, 0.3], [48, -95, 0, true], [-48, -95, 0]],
    snakes: [[-30, -40], [35, -140]],
    elephants: [[50, -60, 58, -75]],
    portals: [[-50, -50, 50, -140]],
    mystery: [[0, -110], [30, -160]],
  },
  {
    name: 'Hot Springs',
    tornados: [[30, -110, 9]],
    webChains: [[-30, -45, 2.6, 3, 12]],
    path: [[0, 0], [0, -158]],
    land: [[0, -10, 32], [0, -75, 60], [0, -156, 40], [-52, -110, 30], [52, -110, 30], [-50, -40, 22], [50, -40, 22]],
    lavaRings: [[0, -158, 18, 28]],
    belts: [[0, -110, 0, -141, 5, false]],
    ponds: [[-30, -70, 10, 7], [30, -70, 10, 7], [-45, -110, 8, 6]],
    lava: [[0, -38, 8, 5]],
    platforms: [[20, -172, 3], [-20, -144, 3]],
    webs: [[-20, -25, 0.4, true], [40, -125, 0], [-40, -130, 0.3]],
    snakes: [[50, -100], [-45, -132]],
    elephants: [[-20, -95, -5, -100]],
    portals: [[30, -70, -45, -110], [25, -25, -22, -182]],
    mystery: [[0, -75], [45, -40]],
  },
  {
    name: 'Inferno Arena',
    trains: [{ pts: [[36, -115], [26, -140], [0, -152], [-26, -140], [-36, -115], [-26, -90], [0, -78], [26, -90]], cars: 3 }],
    tornados: [[40, -170, 9]],
    path: [[0, 0], [0, -215]],
    land: [[0, -10, 35], [0, -100, 75], [0, -206, 42], [-70, -150, 38], [70, -150, 38], [-62, -50, 30], [62, -50, 30], [-25, -175, 22], [35, -195, 20]],
    mountains: [[0, -115, 24, 16]],
    lava: [[-40, -70, 14, 9], [40, -170, 13, 9], [45, -80, 9, 7]],
    lavaRivers: [{ w: 7, pts: [[-25, -140], [-45, -155], [-65, -180]] }],
    platforms: [[-40, -70, 3.5], [40, -170, 3.5], [-45, -155, 3]],
    ponds: [[52, -50, 12, 9], [-55, -40, 9, 7]],
    webs: [[-50, -95, 0], [50, -125, 0.4], [-80, -140, 0], [20, -190, 0.2, true], [0, -40, 0]],
    belts: [[60, -95, 72, -130, 5, true]],
    elephants: [[72, -140, 80, -158], [-20, -60, -30, -50]],
    snakes: [[-28, -175], [35, -92], [50, -30], [-55, -112]],
    portals: [[52, -50, -30, -205], [-55, -40, 35, -200]],
    mystery: [[-20, -160], [60, -130]],
  },
];

export const WORLDS = {
  tropical: { name: 'Tropical Island', icon: '🌴', theme: 'tropical', holes: HOLES },
  ice: { name: 'Ice World', icon: '❄️', theme: 'ice', holes: ICE_HOLES },
  lava: { name: 'Lava World', icon: '🌋', theme: 'lava', holes: LAVA_HOLES },
};
