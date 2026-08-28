import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const sharp = (() => {
  try {
    return require('sharp');
  } catch {
    return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp'));
  }
})();

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WIDTH = 1024;
const HEIGHT = 1536;
const OUT = path.join(ROOT, 'playfields');

const commonTuning = {
  coordinateSystem: 'top-left-origin-y-down',
  pixelsPerMeter: 100,
  gravity: {x: 0, y: 980},
  fixedTimeStepSeconds: 0.0166667,
  maximumSubSteps: 3,
  ball: {
    radius: 16,
    mass: 1,
    restitution: 0.55,
    friction: 0.08,
    linearDamping: 0.035,
    maximumSpeed: 1800
  },
  wall: {restitution: 0.52, friction: 0.1},
  bumper: {restitution: 1.22, impulse: 760, cooldownMilliseconds: 90},
  slingshot: {restitution: 1.05, impulse: 560, cooldownMilliseconds: 100},
  flipper: {
    angularSpeedDegreesPerSecond: 720,
    returnSpeedDegreesPerSecond: 560,
    restitution: 0.35,
    friction: 0.18,
    maximumTorque: 1450
  },
  plunger: {
    minimumImpulse: 650,
    maximumImpulse: 1700,
    fullChargeMilliseconds: 900
  },
  nudge: {impulse: 120, lockoutMilliseconds: 350, tiltThreshold: 3}
};

const boards = [
  {
    id: 'table-for-two',
    title: 'Table for Two',
    boardAsset: '../../boards/table-for-two.png',
    headerBottom: 178,
    playfieldBounds: [[20, 180], [1004, 180], [1004, 1518], [20, 1518]],
    launcher: {
      lane: [[894, 835], [982, 835], [982, 1490], [894, 1490]],
      spawn: [936, 1220],
      launchDirectionDegrees: -90,
      exitSensor: {x: 854, y: 390, width: 112, height: 150}
    },
    flippers: [
      {id: 'main-left', side: 'left', pivot: [252, 1230], length: 166, thickness: 30, restAngle: 24, activeAngle: -28},
      {id: 'main-right', side: 'right', pivot: [772, 1230], length: 166, thickness: 30, restAngle: 156, activeAngle: 208},
      {id: 'upper-right', side: 'right', pivot: [894, 487], length: 108, thickness: 27, restAngle: 151, activeAngle: 205}
    ],
    bumpers: [
      {id: 'plate-1', center: [391, 697], radius: 43},
      {id: 'plate-2', center: [468, 772], radius: 43},
      {id: 'plate-3', center: [569, 823], radius: 43},
      {id: 'plate-4', center: [681, 853], radius: 43},
      {id: 'plate-5', center: [785, 803], radius: 43}
    ],
    targets: [
      {id: 'target-c', label: 'C', rect: [236, 548, 70, 66]},
      {id: 'target-h', label: 'H', rect: [236, 620, 70, 66]},
      {id: 'target-e-1', label: 'E', rect: [236, 694, 70, 66]},
      {id: 'target-e-2', label: 'E', rect: [236, 768, 70, 66]},
      {id: 'target-r', label: 'R', rect: [236, 842, 70, 66]},
      {id: 'target-s', label: 'S', rect: [236, 916, 70, 66]}
    ],
    slingshots: [
      {id: 'left-sling', polygon: [[160, 1050], [211, 1178], [351, 1210], [204, 1082]]},
      {id: 'right-sling', polygon: [[864, 1050], [813, 1178], [673, 1210], [820, 1082]]}
    ],
    drains: [
      {id: 'center-drain', shape: 'circle', center: [512, 1340], radius: 50, event: 'ballDrained'},
      {id: 'left-outlane', shape: 'rect', rect: [58, 1362, 170, 145], event: 'ballDrained'},
      {id: 'right-outlane', shape: 'rect', rect: [796, 1362, 170, 145], event: 'ballDrained'}
    ],
    walls: [
      {id: 'outer-left', thickness: 18, points: [[54, 188], [24, 226], [24, 1492], [420, 1515]]},
      {id: 'outer-right', thickness: 18, points: [[972, 188], [1000, 226], [1000, 1492], [608, 1515]]},
      {id: 'launcher-divider', thickness: 18, points: [[894, 1512], [894, 910], [866, 838], [852, 730], [850, 640], [825, 570]]},
      {id: 'left-spiral-outer', thickness: 17, points: [[334, 559], [250, 554], [164, 520], [108, 462], [78, 386], [80, 312], [114, 252], [176, 218], [256, 210], [326, 230], [374, 276], [397, 338], [398, 412], [370, 480], [334, 522]]},
      {id: 'left-spiral-inner', thickness: 15, points: [[328, 454], [274, 468], [215, 456], [175, 422], [156, 369], [164, 315], [198, 282], [250, 270], [300, 284], [330, 315], [341, 360], [338, 404], [321, 432]]},
      {id: 'crossover-upper', thickness: 18, points: [[438, 315], [489, 286], [537, 311], [600, 405], [663, 498], [729, 565], [817, 614]]},
      {id: 'crossover-lower', thickness: 18, points: [[463, 352], [500, 326], [540, 349], [594, 433], [650, 526], [720, 600], [816, 651]]},
      {id: 'left-return-rail', thickness: 18, points: [[132, 517], [98, 556], [100, 906], [128, 1010], [180, 1118], [222, 1187]]},
      {id: 'right-return-rail', thickness: 18, points: [[864, 590], [879, 718], [865, 871], [844, 1010], [807, 1110], [780, 1188]]}
    ],
    sensors: [
      {id: 'profile-door', type: 'rect', rect: [704, 413, 122, 96], event: 'profileRevealDoor'},
      {id: 'spiral-loop', type: 'polygon', polygon: [[92, 250], [393, 250], [393, 548], [92, 548]], event: 'toastTimeLoop'},
      {id: 'crossover-ramp', type: 'polygon', polygon: [[434, 288], [818, 585], [818, 658], [456, 370]], event: 'rampCompleted'},
      {id: 'extra-ball-shot', type: 'rect', rect: [838, 425, 92, 186], event: 'extraBallShot'},
      {id: 'skill-shot', type: 'rect', rect: [884, 720, 92, 120], event: 'skillShot'}
    ],
    occlusionPaths: [
      {id: 'spiral-front-rail', width: 22, points: [[88, 372], [104, 462], [170, 528], [252, 556], [338, 552]]},
      {id: 'crossover-front-rail', width: 24, points: [[463, 352], [540, 349], [594, 433], [650, 526], [720, 600], [816, 651]]},
      {id: 'launcher-front-rail', width: 22, points: [[894, 1512], [894, 910], [866, 838], [852, 730]]}
    ],
    specialMode: 'toast-time'
  },
  {
    id: 'reel-romance',
    title: 'Reel Romance',
    boardAsset: '../../boards/reel-romance.png',
    headerBottom: 142,
    playfieldBounds: [[18, 144], [1006, 144], [1006, 1518], [18, 1518]],
    launcher: {
      lane: [[923, 1018], [998, 1018], [998, 1482], [923, 1482]],
      spawn: [962, 1312],
      launchDirectionDegrees: -90,
      exitSensor: {x: 868, y: 388, width: 116, height: 220}
    },
    flippers: [
      {id: 'main-left', side: 'left', pivot: [263, 1304], length: 170, thickness: 30, restAngle: 24, activeAngle: -28},
      {id: 'main-right', side: 'right', pivot: [740, 1304], length: 170, thickness: 30, restAngle: 156, activeAngle: 208}
    ],
    bumpers: [
      {id: 'popcorn-1', center: [735, 579], radius: 55},
      {id: 'popcorn-2', center: [736, 763], radius: 55},
      {id: 'popcorn-3', center: [739, 950], radius: 55}
    ],
    targets: [
      {id: 'target-r', label: 'R', rect: [158, 746, 76, 80]},
      {id: 'target-e-1', label: 'E', rect: [244, 812, 76, 80]},
      {id: 'target-e-2', label: 'E', rect: [330, 878, 76, 80]},
      {id: 'target-l', label: 'L', rect: [416, 942, 76, 80]}
    ],
    slingshots: [
      {id: 'left-sling', polygon: [[183, 1057], [248, 1170], [331, 1215], [233, 1082]]},
      {id: 'right-sling', polygon: [[841, 1057], [776, 1170], [693, 1215], [791, 1082]]}
    ],
    drains: [
      {id: 'center-drain', shape: 'circle', center: [512, 1414], radius: 55, event: 'ballDrained'},
      {id: 'left-outlane', shape: 'rect', rect: [45, 1325, 180, 175], event: 'ballDrained'},
      {id: 'right-outlane', shape: 'rect', rect: [799, 1325, 150, 175], event: 'ballDrained'}
    ],
    walls: [
      {id: 'outer-left', thickness: 18, points: [[20, 148], [20, 1510], [362, 1515]]},
      {id: 'outer-right', thickness: 18, points: [[1004, 148], [1004, 1510], [632, 1515]]},
      {id: 'launcher-divider', thickness: 18, points: [[916, 1510], [916, 1260], [878, 1184], [852, 1050], [850, 865], [885, 750], [902, 605], [902, 430]]},
      {id: 'conveyor-upper', thickness: 16, points: [[231, 790], [675, 345]]},
      {id: 'conveyor-lower', thickness: 16, points: [[321, 846], [735, 410]]},
      {id: 'left-return', thickness: 18, points: [[142, 666], [106, 760], [109, 950], [144, 1087], [225, 1215]]},
      {id: 'right-return', thickness: 18, points: [[868, 620], [858, 870], [844, 1030], [806, 1160], [781, 1222]]}
    ],
    circularWalls: [
      {id: 'film-loop-outer', center: [304, 354], radius: 253, thickness: 16},
      {id: 'film-loop-inner', center: [304, 354], radius: 191, thickness: 14}
    ],
    sensors: [
      {id: 'profile-door', type: 'rect', rect: [714, 171, 214, 188], event: 'profileRevealDoor'},
      {id: 'film-loop', type: 'circle', center: [304, 354], radius: 220, event: 'filmLoopCompleted'},
      {id: 'conveyor-ramp', type: 'polygon', polygon: [[226, 760], [693, 323], [748, 407], [316, 866]], event: 'doubleFeatureRamp'},
      {id: 'extra-ball-shot', type: 'rect', rect: [858, 735, 72, 260], event: 'extraBallShot'},
      {id: 'skill-shot', type: 'rect', rect: [920, 1018, 78, 168], event: 'skillShot'}
    ],
    occlusionPaths: [
      {id: 'film-loop-front', width: 24, points: [[78, 435], [130, 535], [230, 591], [340, 590], [449, 535]]},
      {id: 'conveyor-front-rail', width: 24, points: [[321, 846], [735, 410]]},
      {id: 'launcher-front-rail', width: 22, points: [[916, 1510], [916, 1260], [878, 1184], [852, 1050]]}
    ],
    specialMode: 'double-feature'
  },
  {
    id: 'bad-date-ghosted',
    title: 'Bad Date: Ghosted',
    boardAsset: '../../boards/bad-date-ghosted.png',
    headerBottom: 119,
    playfieldBounds: [[18, 121], [1006, 121], [1006, 1518], [18, 1518]],
    launcher: {
      lane: [[909, 942], [995, 942], [995, 1485], [909, 1485]],
      spawn: [951, 1320],
      launchDirectionDegrees: -90,
      exitSensor: {x: 844, y: 650, width: 138, height: 294}
    },
    flippers: [
      {id: 'main-left', side: 'left', pivot: [325, 1360], length: 170, thickness: 30, restAngle: 22, activeAngle: -30},
      {id: 'main-right', side: 'right', pivot: [691, 1360], length: 170, thickness: 30, restAngle: 158, activeAngle: 210}
    ],
    bumpers: [
      {id: 'skull-1', center: [518, 560], radius: 54},
      {id: 'skull-2', center: [389, 681], radius: 54},
      {id: 'skull-3', center: [649, 736], radius: 54}
    ],
    targets: [
      {id: 'target-g', label: 'G', rect: [271, 840, 63, 112]},
      {id: 'target-h', label: 'H', rect: [345, 810, 63, 112]},
      {id: 'target-o', label: 'O', rect: [419, 790, 63, 112]},
      {id: 'target-s', label: 'S', rect: [493, 782, 63, 112]},
      {id: 'target-t', label: 'T', rect: [567, 790, 63, 112]},
      {id: 'target-e', label: 'E', rect: [641, 810, 63, 112]},
      {id: 'target-d', label: 'D', rect: [715, 840, 63, 112]}
    ],
    slingshots: [
      {id: 'left-sling', polygon: [[207, 1110], [253, 1249], [377, 1305], [286, 1150]]},
      {id: 'right-sling', polygon: [[817, 1110], [771, 1249], [647, 1305], [738, 1150]]}
    ],
    drains: [
      {id: 'center-drain', shape: 'circle', center: [512, 1341], radius: 59, event: 'ballDrained'},
      {id: 'left-outlane', shape: 'rect', rect: [42, 1290, 190, 202], event: 'ballDrained'},
      {id: 'right-outlane', shape: 'rect', rect: [792, 1290, 140, 202], event: 'ballDrained'}
    ],
    walls: [
      {id: 'outer-left', thickness: 18, points: [[18, 123], [18, 1510], [429, 1517]]},
      {id: 'outer-right', thickness: 18, points: [[1006, 123], [1006, 1510], [602, 1517]]},
      {id: 'launcher-divider', thickness: 18, points: [[903, 1510], [903, 1220], [860, 1140], [842, 1018], [846, 922]]},
      {id: 'coffin-ramp-left', thickness: 17, points: [[61, 430], [92, 463], [113, 612], [105, 760], [124, 900], [168, 1045], [225, 1135]]},
      {id: 'coffin-ramp-right', thickness: 17, points: [[112, 430], [147, 473], [171, 615], [164, 760], [183, 895], [222, 1008], [279, 1090]]},
      {id: 'ghost-tube-left', thickness: 18, points: [[773, 322], [824, 332], [856, 390], [834, 487], [792, 582], [806, 686], [850, 779], [840, 914]]},
      {id: 'ghost-tube-right', thickness: 18, points: [[922, 322], [957, 377], [932, 492], [888, 586], [900, 698], [944, 790], [923, 945]]},
      {id: 'left-return', thickness: 18, points: [[125, 930], [146, 1060], [196, 1174], [272, 1274]]},
      {id: 'right-return', thickness: 18, points: [[850, 950], [836, 1074], [792, 1178], [747, 1277]]}
    ],
    sensors: [
      {id: 'profile-door', type: 'rect', rect: [404, 241, 222, 198], event: 'profileRevealDoor'},
      {id: 'coffin-ramp', type: 'polygon', polygon: [[60, 422], [146, 447], [282, 1080], [220, 1144], [120, 940]], event: 'escapeRampLeft'},
      {id: 'ghost-tube', type: 'polygon', polygon: [[770, 310], [936, 310], [966, 420], [884, 607], [958, 800], [920, 962], [830, 930], [804, 720], [780, 550]], event: 'escapeRampRight'},
      {id: 'extra-ball-shot', type: 'rect', rect: [823, 690, 126, 268], event: 'extraBallShot'},
      {id: 'skill-shot', type: 'rect', rect: [908, 942, 88, 186], event: 'skillShot'},
      {id: 'skeleton-kicker', type: 'rect', rect: [568, 1078, 155, 120], event: 'kickerActivated'}
    ],
    occlusionPaths: [
      {id: 'coffin-front-rail', width: 24, points: [[112, 430], [147, 473], [171, 615], [164, 760], [183, 895], [222, 1008], [279, 1090]]},
      {id: 'ghost-tube-front-rail', width: 28, points: [[922, 322], [957, 377], [932, 492], [888, 586], [900, 698], [944, 790], [923, 945]]},
      {id: 'launcher-front-rail', width: 22, points: [[903, 1510], [903, 1220], [860, 1140], [842, 1018]]}
    ],
    specialMode: 'escape-the-graveyard'
  }
];

const colors = {
  wall: '#ff245f',
  bumper: '#00e5ff',
  target: '#ffe45c',
  sensor: '#72ff63',
  drain: '#ff8a33',
  flipper: '#ffffff',
  sling: '#d36cff'
};

const points = value => value.map(([x, y]) => `${x},${y}`).join(' ');
const pathData = value => value.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');
const normPoint = ([x, y]) => ({x: +(x / WIDTH).toFixed(6), y: +(y / HEIGHT).toFixed(6)});
const normRect = ([x, y, width, height]) => ({x: +(x / WIDTH).toFixed(6), y: +(y / HEIGHT).toFixed(6), width: +(width / WIDTH).toFixed(6), height: +(height / HEIGHT).toFixed(6)});

function normalizedBoard(board) {
  return {
    ...board,
    schema: 'love-on-tilt/physics-playfield@1',
    version: '1.0.0',
    canvas: {width: WIDTH, height: HEIGHT},
    sourceArtwork: board.boardAsset,
    layerOrder: ['sourceArtwork', 'ball-and-runtime-mechanisms', 'foreground-overlay', 'hud-and-callouts'],
    tuning: commonTuning,
    normalized: {
      playfieldBounds: board.playfieldBounds.map(normPoint),
      launcher: {
        lane: board.launcher.lane.map(normPoint),
        spawn: normPoint(board.launcher.spawn),
        exitSensor: normRect([board.launcher.exitSensor.x, board.launcher.exitSensor.y, board.launcher.exitSensor.width, board.launcher.exitSensor.height])
      },
      flippers: board.flippers.map(item => ({id: item.id, pivot: normPoint(item.pivot), lengthX: +(item.length / WIDTH).toFixed(6), thicknessY: +(item.thickness / HEIGHT).toFixed(6)})),
      bumpers: board.bumpers.map(item => ({id: item.id, center: normPoint(item.center), radiusX: +(item.radius / WIDTH).toFixed(6), radiusY: +(item.radius / HEIGHT).toFixed(6)})),
      targets: board.targets.map(item => ({id: item.id, rect: normRect(item.rect)})),
      slingshots: board.slingshots.map(item => ({id: item.id, polygon: item.polygon.map(normPoint)})),
      drains: board.drains.map(item => item.shape === 'circle'
        ? {id: item.id, center: normPoint(item.center), radiusX: +(item.radius / WIDTH).toFixed(6), radiusY: +(item.radius / HEIGHT).toFixed(6)}
        : {id: item.id, rect: normRect(item.rect)}),
      walls: board.walls.map(item => ({id: item.id, points: item.points.map(normPoint), thicknessX: +(item.thickness / WIDTH).toFixed(6)})),
      circularWalls: (board.circularWalls ?? []).map(item => ({id: item.id, center: normPoint(item.center), radiusX: +(item.radius / WIDTH).toFixed(6), radiusY: +(item.radius / HEIGHT).toFixed(6)})),
      sensors: board.sensors.map(item => ({
        id: item.id,
        ...(item.type === 'rect' ? {rect: normRect(item.rect)} : {}),
        ...(item.type === 'circle' ? {center: normPoint(item.center), radiusX: +(item.radius / WIDTH).toFixed(6), radiusY: +(item.radius / HEIGHT).toFixed(6)} : {}),
        ...(item.type === 'polygon' ? {polygon: item.polygon.map(normPoint)} : {})
      }))
    },
    files: {
      collisionMask: 'collision-mask.png',
      collisionDebug: 'collision-debug.png',
      foregroundMask: 'foreground-mask.png',
      foregroundOverlay: 'foreground-overlay.png'
    },
    implementationNote: 'Pixel coordinates are authoritative for the 1024×1536 source. Normalized coordinates are provided for responsive scaling. Tune collider placement in the target engine after device-level playtesting.'
  };
}

function shapeSvg(board, debug = false) {
  const opacity = debug ? 0.45 : 1;
  const labelParts = [];
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" shape-rendering="geometricPrecision">`];
  if (!debug) parts.push(`<rect width="100%" height="100%" fill="#000000"/>`);
  for (const wall of board.walls) {
    parts.push(`<polyline points="${points(wall.points)}" fill="none" stroke="${colors.wall}" stroke-width="${wall.thickness}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`);
  }
  for (const wall of board.circularWalls ?? []) {
    parts.push(`<circle cx="${wall.center[0]}" cy="${wall.center[1]}" r="${wall.radius}" fill="none" stroke="${colors.wall}" stroke-width="${wall.thickness}" opacity="${opacity}"/>`);
  }
  for (const bumper of board.bumpers) {
    parts.push(`<circle cx="${bumper.center[0]}" cy="${bumper.center[1]}" r="${bumper.radius}" fill="${colors.bumper}" opacity="${opacity}"/>`);
    if (debug) labelParts.push([bumper.center[0], bumper.center[1], bumper.id]);
  }
  for (const target of board.targets) {
    parts.push(`<rect x="${target.rect[0]}" y="${target.rect[1]}" width="${target.rect[2]}" height="${target.rect[3]}" fill="${colors.target}" opacity="${opacity}"/>`);
  }
  for (const sling of board.slingshots) {
    parts.push(`<polygon points="${points(sling.polygon)}" fill="${colors.sling}" opacity="${opacity}"/>`);
  }
  for (const sensor of board.sensors) {
    if (sensor.type === 'rect') parts.push(`<rect x="${sensor.rect[0]}" y="${sensor.rect[1]}" width="${sensor.rect[2]}" height="${sensor.rect[3]}" fill="${colors.sensor}" opacity="${debug ? 0.28 : 1}"/>`);
    if (sensor.type === 'circle') parts.push(`<circle cx="${sensor.center[0]}" cy="${sensor.center[1]}" r="${sensor.radius}" fill="${colors.sensor}" opacity="${debug ? 0.28 : 1}"/>`);
    if (sensor.type === 'polygon') parts.push(`<polygon points="${points(sensor.polygon)}" fill="${colors.sensor}" opacity="${debug ? 0.22 : 1}"/>`);
    if (debug) {
      const x = sensor.rect?.[0] ?? sensor.center?.[0] ?? sensor.polygon?.[0]?.[0];
      const y = sensor.rect?.[1] ?? sensor.center?.[1] ?? sensor.polygon?.[0]?.[1];
      labelParts.push([x, y, sensor.id]);
    }
  }
  for (const drain of board.drains) {
    if (drain.shape === 'circle') parts.push(`<circle cx="${drain.center[0]}" cy="${drain.center[1]}" r="${drain.radius}" fill="${colors.drain}" opacity="${opacity}"/>`);
    else parts.push(`<rect x="${drain.rect[0]}" y="${drain.rect[1]}" width="${drain.rect[2]}" height="${drain.rect[3]}" fill="${colors.drain}" opacity="${opacity}"/>`);
  }
  for (const flipper of board.flippers) {
    const radians = flipper.restAngle * Math.PI / 180;
    const x2 = flipper.pivot[0] + Math.cos(radians) * flipper.length;
    const y2 = flipper.pivot[1] + Math.sin(radians) * flipper.length;
    parts.push(`<line x1="${flipper.pivot[0]}" y1="${flipper.pivot[1]}" x2="${x2}" y2="${y2}" stroke="${colors.flipper}" stroke-width="${flipper.thickness}" stroke-linecap="round" opacity="${opacity}"/>`);
  }
  if (debug) {
    parts.push(`<circle cx="${board.launcher.spawn[0]}" cy="${board.launcher.spawn[1]}" r="20" fill="#ffffff" stroke="#000000" stroke-width="4"/>`);
    for (const [x, y, label] of labelParts) {
      parts.push(`<text x="${x}" y="${y - 10}" text-anchor="middle" fill="#ffffff" stroke="#000000" stroke-width="4" paint-order="stroke" font-family="monospace" font-weight="bold" font-size="15">${label}</text>`);
    }
  }
  parts.push('</svg>');
  return Buffer.from(parts.join(''));
}

function occlusionSvg(board, flatten = false) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`];
  if (flatten) parts.push('<rect width="100%" height="100%" fill="#000000"/>');
  for (const item of board.occlusionPaths) {
    parts.push(`<path d="${pathData(item.points)}" fill="none" stroke="#ffffff" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  parts.push('</svg>');
  return Buffer.from(parts.join(''));
}

async function buildBoard(board) {
  const directory = path.join(OUT, board.id);
  await fs.rm(directory, {recursive: true, force: true});
  await fs.mkdir(directory, {recursive: true});
  const sourcePath = path.resolve(directory, board.boardAsset);
  const maskSvg = shapeSvg(board, false);
  const debugSvg = shapeSvg(board, true);
  await sharp(maskSvg).png().toFile(path.join(directory, 'collision-mask.png'));
  await sharp(sourcePath).composite([{input: debugSvg, left: 0, top: 0}]).png().toFile(path.join(directory, 'collision-debug.png'));
  const alphaMask = await sharp(occlusionSvg(board, true)).flatten({background: '#000000'}).greyscale().raw().toBuffer({resolveWithObject: true});
  await sharp(alphaMask.data, {raw: {width: WIDTH, height: HEIGHT, channels: 1}}).png().toFile(path.join(directory, 'foreground-mask.png'));
  const sourcePixels = await sharp(sourcePath).removeAlpha().raw().toBuffer();
  const overlayPixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    overlayPixels[i * 4] = sourcePixels[i * 3];
    overlayPixels[i * 4 + 1] = sourcePixels[i * 3 + 1];
    overlayPixels[i * 4 + 2] = sourcePixels[i * 3 + 2];
    overlayPixels[i * 4 + 3] = alphaMask.data[i];
  }
  await sharp(overlayPixels, {raw: {width: WIDTH, height: HEIGHT, channels: 4}}).png().toFile(path.join(directory, 'foreground-overlay.png'));
  const manifest = normalizedBoard(board);
  await fs.writeFile(path.join(directory, 'physics-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    id: board.id,
    title: board.title,
    manifest: `${board.id}/physics-manifest.json`,
    debugPreview: `${board.id}/collision-debug.png`,
    collisionMask: `${board.id}/collision-mask.png`,
    foregroundOverlay: `${board.id}/foreground-overlay.png`
  };
}

await fs.mkdir(OUT, {recursive: true});
const entries = [];
for (const board of boards) entries.push(await buildBoard(board));
const catalog = {
  schema: 'love-on-tilt/playfield-catalog@1',
  version: '1.0.0',
  coordinateSystem: '1024×1536 pixels plus normalized 0–1 coordinates',
  colorMaskLegend: colors,
  collisionSourceOfTruth: 'physics-manifest.json',
  boards: entries
};
await fs.writeFile(path.join(OUT, 'playfield-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);

const debugImages = [];
for (const entry of entries) {
  debugImages.push(await sharp(path.join(OUT, entry.debugPreview)).resize(512, 768, {kernel: 'nearest'}).png().toBuffer());
}
await sharp({create: {width: 1536, height: 768, channels: 4, background: {r: 8, g: 5, b: 25, alpha: 1}}})
  .composite(debugImages.map((input, index) => ({input, left: index * 512, top: 0})))
  .png().toFile(path.join(ROOT, 'previews/physics-playfields-debug.png'));

const occlusionImages = [];
for (const entry of entries) {
  const overlay = await sharp(path.join(OUT, entry.foregroundOverlay)).resize(512, 768, {kernel: 'nearest'}).png().toBuffer();
  occlusionImages.push(await sharp({create: {width: 512, height: 768, channels: 4, background: {r: 30, g: 8, b: 52, alpha: 1}}})
    .composite([{input: overlay, left: 0, top: 0}]).png().toBuffer());
}
await sharp({create: {width: 1536, height: 768, channels: 4, background: {r: 8, g: 5, b: 25, alpha: 1}}})
  .composite(occlusionImages.map((input, index) => ({input, left: index * 512, top: 0})))
  .png().toFile(path.join(ROOT, 'previews/foreground-occlusion-debug.png'));

console.log(`Built physics playfields for ${entries.length} distinct boards.`);
