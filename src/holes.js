// Hole layouts. Coordinates are metres on the ground plane: [x, z].
// The first path point is the tee, the last is the cup. Play mostly runs toward -z.
//
// bunkers:  [x, z, radius]
// ponds:    [x, z, radiusX, radiusZ]       water inside the island (frogs swim out, +points)
// moats:    [x, z, innerR, outerR]         a ring of water (island greens)
// hills:    [x, z, radius, height]
// webs:     [x, z, angle]                  spider-web trampolines: bounce + double points
// belts:    [x1, z1, x2, z2, width]        conveyor belts, carry the frog from 1 toward 2
// elephants:[x1, z1, x2, z2]               wander between two points, toss frogs at the cup

export const HOLES = [
  {
    name: 'Lily Lane',
    path: [[0, 0], [0, -50], [4, -95]],
    width: 13,
    bunkers: [[11, -80, 5], [-8, -101, 4]],
    hills: [[20, -40, 14, 4], [-22, -70, 16, 3.5]],
    webs: [[-7, -46, 0.2]],
  },
  {
    name: 'Web Wonder',
    path: [[0, 0], [-10, -60], [0, -125]],
    width: 14,
    ponds: [[13, -62, 9, 15]],
    bunkers: [[7, -117, 4]],
    hills: [[-30, -30, 15, 4], [25, -110, 14, 3]],
    webs: [[-4, -32, 0], [-14, -72, 0.5], [3, -98, 0]],
  },
  {
    name: 'Belt Bay',
    path: [[0, 0], [0, -70], [45, -108], [88, -114]],
    width: 13,
    ponds: [[28, -55, 10, 9]],
    bunkers: [[93, -104, 4], [60, -98, 3.5]],
    hills: [[-22, -60, 16, 4]],
    belts: [[-2, -48, 17, -64, 5], [62, -112, 79, -114, 4.5]],
    webs: [[38, -96, 0.6]],
  },
  {
    name: 'Mammoth Meadow',
    path: [[0, 0], [0, -80], [-22, -150]],
    width: 16,
    bunkers: [[-30, -140, 4.5], [-10, -158, 3.5]],
    hills: [[24, -90, 16, 4], [-30, -40, 15, 3]],
    webs: [[-11, -88, 0]],
    elephants: [[10, -52, 6, -68], [-6, -118, -20, -112]],
  },
  {
    name: 'Splash Isle',
    path: [[0, 0], [0, -60], [0, -122]],
    width: 12,
    moats: [[0, -122, 15, 26]],
    bunkers: [[-10, -40, 4]],
    hills: [[24, -50, 14, 3.5], [-24, -80, 14, 3]],
    belts: [[0, -79, 0, -109, 5]],
    webs: [[-8, -55, 0.3]],
  },
  {
    name: 'Grand Frolf',
    path: [[0, 0], [0, -70], [-40, -130], [-40, -200]],
    width: 14,
    ponds: [[-12, -148, 10, 14]],
    bunkers: [[-33, -197, 4], [-48, -188, 3.5]],
    hills: [[24, -60, 16, 4], [-60, -100, 16, 3.5]],
    webs: [[6, -42, 0], [-28, -118, 0.6]],
    belts: [[-8, -86, -25, -108, 5]],
    elephants: [[-52, -160, -50, -175]],
  },
];
