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
const GRID = 4;
const SOURCES = {
  status: path.join(ROOT, 'source/ui-status-master.png'),
  events: path.join(ROOT, 'source/ui-events-master.png'),
  achievements: path.join(ROOT, 'source/ui-achievements-master.png')
};
const OUTPUT_ROOT = path.join(ROOT, 'assets/ui-common');

const groups = [
  {
    id: 'extra-ball', source: 'status', cells: [0, 1, 2, 3], canvas: [256, 256], fps: 8, loop: false,
    states: ['idle', 'glow', 'pulse', 'award-burst'], usage: 'Extra ball icon and award animation.'
  },
  {
    id: 'ball-save', source: 'status', cells: [4, 5, 6, 7], canvas: [256, 256], fps: 10, loop: false,
    states: ['unlit', 'active', 'impact', 'break'], usage: 'Shield state and saved-ball impact animation.'
  },
  {
    id: 'chemistry-meter', source: 'status', cells: [8, 9, 10, 11, 12], canvas: [384, 160], fps: 0, loop: false,
    states: ['empty', '25-percent', '50-percent', '75-percent', 'full'], values: [0, 25, 50, 75, 100],
    usage: 'Discrete Chemistry HUD states. The engine selects a frame; it does not play them as a timed animation.'
  },
  {
    id: 'heart-collectible', source: 'status', cells: [13, 14, 14], canvas: [256, 256], fps: 8, loop: false,
    states: ['idle', 'pulse', 'collect-burst'], transforms: [null, null, 'collect-burst'], usage: 'Profile Reel progress heart and table collectible.'
  },
  {
    id: 'multiplier', source: 'events', cells: [0, 1, 2, 3], canvas: [256, 256], fps: 0, loop: false,
    states: ['x2', 'x3', 'x4', 'x5'], text: ['×2', '×3', '×4', '×5'],
    textOptions: {y: 0.53, fontSize: 72, fill: '#fff8dc', stroke: '#070517'}, usage: 'Exact multiplier medallions.'
  },
  {
    id: 'double-date-multiball', source: 'events', cells: [4, 5, 6, 7], canvas: [320, 320], fps: 10, loop: false,
    states: ['approach', 'collision', 'heart-burst', 'celebration'],
    overlays: [null, null, null, [{text: 'DOUBLE DATE', y: 0.84, fontSize: 30, box: true}]],
    usage: 'Four-frame Double Date two-ball celebration.'
  },
  {
    id: 'reward-banner-animation', source: 'events', cells: [8, 9, 10, 11], canvas: [512, 192], fps: 12, loop: false,
    states: ['closed', 'expand', 'lit', 'flash'], usage: 'Blank reward-banner transition for runtime-composed messages.'
  },
  {
    id: 'reward-banner', source: 'events', cells: [10, 10, 10, 10, 10], canvas: [512, 192], fps: 0, loop: false,
    states: ['extra-ball', 'ball-save', 'double-date', 'profile-reveal', 'super-jackpot'],
    text: ['EXTRA BALL', 'BALL SAVE', 'DOUBLE DATE', 'PROFILE REVEAL', 'SUPER JACKPOT'],
    textOptions: {y: 0.52, fontSize: 36, fill: '#fff8dc', stroke: '#070517', box: true}, individualBounds: true,
    usage: 'Exact, static reward callouts.'
  },
  {
    id: 'jackpot-numeral', source: 'events', cells: [12, 13, 14, 15], canvas: [512, 220], fps: 0, loop: false,
    states: ['5000', '10000', '25000', '50000'], text: ['5,000', '10,000', '25,000', '50,000'],
    textOptions: {y: 0.52, fontSize: 56, fill: '#fff8dc', stroke: '#070517'}, individualBounds: true,
    usage: 'Exact escalating jackpot values.'
  },
  {
    id: 'arcade-ticket', source: 'achievements', cells: [0, 1, 2, 3], canvas: [384, 220], fps: 8, loop: true,
    states: ['front', 'turn', 'edge', 'sparkle'],
    overlays: [
      [{text: 'ARCADE', y: 0.52, fontSize: 30}],
      [{text: 'ARCADE', y: 0.52, fontSize: 28}],
      null,
      [{text: 'ARCADE', y: 0.52, fontSize: 30}]
    ],
    usage: 'Session-only in-game bonus marker; not persistent currency and not an app-level reward.'
  },
  {
    id: 'achievement-badge', source: 'achievements', cells: [4, 5, 6, 7, 8, 9, 10, 11], canvas: [320, 320], fps: 0, loop: false,
    states: ['first-reel', 'double-date', 'jackpot', 'full-chemistry', 'table-ready', 'now-showing', 'unghosted', 'high-score'],
    text: ['FIRST REEL', 'DOUBLE DATE', 'JACKPOT', '100% CHEM', 'TABLE READY', 'NOW SHOWING', 'UN-GHOSTED', 'HIGH SCORE'],
    textOptions: {y: 0.81, fontSize: 22, fill: '#ffffff', stroke: '#070517'}, individualBounds: true,
    usage: 'Session achievement callouts only; no persistent app economy or profile-ranking benefit.'
  },
  {
    id: 'end-of-ball-panel', source: 'achievements', cells: [12, 13, 14, 15], canvas: [512, 320], fps: 10, loop: false,
    states: ['closed', 'unfolding', 'open', 'complete'],
    overlays: [
      null,
      [{text: 'END OF BALL', y: 0.37, fontSize: 32}],
      [{text: 'END OF BALL', y: 0.29, fontSize: 32}, {text: 'SCORE   BONUS   TOTAL', y: 0.58, fontSize: 18}],
      [{text: 'END OF BALL', y: 0.29, fontSize: 32}, {text: 'SCORE   BONUS   TOTAL', y: 0.58, fontSize: 18}]
    ],
    usage: 'Animated tally panel. Runtime numbers are drawn into the declared text slots.'
  }
];

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function isBackground(r, g, b) {
  return Math.min(r, g, b) >= 205 && Math.max(r, g, b) - Math.min(r, g, b) <= 36;
}

function removeDetachedArtifacts(frame) {
  const pixels = frame.width * frame.height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const components = [];
  for (let seed = 0; seed < pixels; seed++) {
    if (visited[seed] || frame.data[seed * 4 + 3] <= 8) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = frame.width;
    let minY = frame.height;
    let maxX = -1;
    let maxY = -1;
    const members = [];
    visited[seed] = 1;
    queue[tail++] = seed;
    while (head < tail) {
      const index = queue[head++];
      members.push(index);
      area++;
      const x = index % frame.width;
      const y = Math.floor(index / frame.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= frame.width || ny >= frame.height) continue;
          const neighbor = ny * frame.width + nx;
          if (!visited[neighbor] && frame.data[neighbor * 4 + 3] > 8) {
            visited[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    components.push({area, minX, minY, maxX, maxY, members});
  }
  if (!components.length) return frame;
  components.sort((a, b) => b.area - a.area);
  const primary = components[0];
  for (const component of components.slice(1)) {
    const near = component.maxX >= primary.minX - 55 && component.minX <= primary.maxX + 55 &&
      component.maxY >= primary.minY - 55 && component.minY <= primary.maxY + 55;
    if (component.area < primary.area * 0.06 && !near) {
      for (const index of component.members) frame.data[index * 4 + 3] = 0;
    }
  }
  return frame;
}

async function transparentCell(file, cellIndex) {
  const image = sharp(file);
  const meta = await image.metadata();
  const col = cellIndex % GRID;
  const row = Math.floor(cellIndex / GRID);
  const left = Math.floor(col * meta.width / GRID);
  const top = Math.floor(row * meta.height / GRID);
  const right = Math.floor((col + 1) * meta.width / GRID);
  const bottom = Math.floor((row + 1) * meta.height / GRID);
  const {data, info} = await image.extract({left, top, width: right - left, height: bottom - top})
    .ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const pixels = info.width * info.height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let head = 0;
  let tail = 0;
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
    const index = y * info.width + x;
    if (visited[index]) return;
    const p = index * 4;
    if (!isBackground(data[p], data[p + 1], data[p + 2])) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < info.width; x++) {
    enqueue(x, 0);
    enqueue(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y++) {
    enqueue(0, y);
    enqueue(info.width - 1, y);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (dx || dy) enqueue(x + dx, y + dy);
    }
  }
  for (let i = 0; i < pixels; i++) if (visited[i]) data[i * 4 + 3] = 0;
  return removeDetachedArtifacts({data, width: info.width, height: info.height});
}

function alphaBounds(frame) {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (frame.data[(y * frame.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('No foreground pixels found.');
  return {minX, minY, maxX, maxY};
}

async function normalizedFrame(frame, union, canvas) {
  const cropWidth = union.maxX - union.minX + 1;
  const cropHeight = union.maxY - union.minY + 1;
  const padding = 18;
  const scale = Math.min(1.35, (canvas[0] - padding * 2) / cropWidth, (canvas[1] - padding * 2) / cropHeight);
  const outWidth = Math.max(1, Math.round(cropWidth * scale));
  const outHeight = Math.max(1, Math.round(cropHeight * scale));
  const paddedWidth = Math.max(frame.width, union.maxX + 1);
  const paddedHeight = Math.max(frame.height, union.maxY + 1);
  let sourceData = frame.data;
  if (paddedWidth !== frame.width || paddedHeight !== frame.height) {
    sourceData = Buffer.alloc(paddedWidth * paddedHeight * 4);
    for (let y = 0; y < frame.height; y++) {
      frame.data.copy(sourceData, y * paddedWidth * 4, y * frame.width * 4, (y + 1) * frame.width * 4);
    }
  }
  const rendered = await sharp(sourceData, {raw: {width: paddedWidth, height: paddedHeight, channels: 4}})
    .extract({left: union.minX, top: union.minY, width: cropWidth, height: cropHeight})
    .resize(outWidth, outHeight, {kernel: 'nearest'})
    .png().toBuffer();
  return sharp({create: {width: canvas[0], height: canvas[1], channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
    .composite([{input: rendered, left: Math.floor((canvas[0] - outWidth) / 2), top: Math.floor((canvas[1] - outHeight) / 2)}])
    .png().toBuffer();
}

async function labelOverlay(canvas, labels) {
  const logicalWidth = Math.floor(canvas[0] / 2);
  const logicalHeight = Math.floor(canvas[1] / 2);
  const pieces = labels.map(label => {
    const y = Math.round((label.y ?? 0.5) * logicalHeight);
    const size = Math.max(6, Math.round((label.fontSize ?? 32) / 2));
    const box = label.box ? `<rect x="${Math.round(logicalWidth * 0.17)}" y="${y - size}" width="${Math.round(logicalWidth * 0.66)}" height="${Math.round(size * 1.6)}" rx="3" fill="#070517" stroke="#ff3cad" stroke-width="2"/>` : '';
    return `${box}<text x="${logicalWidth / 2}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="DejaVu Sans Mono, monospace" font-weight="900" font-size="${size}" fill="${label.fill ?? '#fff8dc'}" stroke="${label.stroke ?? '#070517'}" stroke-width="2" paint-order="stroke">${escapeXml(label.text)}</text>`;
  }).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${logicalWidth}" height="${logicalHeight}">${pieces}</svg>`);
  return sharp(svg).resize(canvas[0], canvas[1], {kernel: 'nearest'}).png().toBuffer();
}

async function applyLabels(buffer, canvas, labels) {
  if (!labels?.length) return buffer;
  const overlay = await labelOverlay(canvas, labels);
  return sharp(buffer).composite([{input: overlay, left: 0, top: 0}]).png().toBuffer();
}

async function applyTransform(buffer, canvas, transform) {
  if (transform !== 'collect-burst') return buffer;
  const heart = await sharp(buffer).resize(Math.round(canvas[0] * 0.72), Math.round(canvas[1] * 0.72), {kernel: 'nearest'}).png().toBuffer();
  const particleSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas[0]}" height="${canvas[1]}">
    <g fill="#ff3cad" stroke="#070517" stroke-width="2">
      <rect x="38" y="72" width="12" height="12"/><rect x="62" y="42" width="9" height="9"/><rect x="92" y="24" width="12" height="12"/>
      <rect x="148" y="24" width="12" height="12"/><rect x="186" y="46" width="9" height="9"/><rect x="208" y="78" width="12" height="12"/>
      <rect x="52" y="142" width="8" height="8"/><rect x="196" y="148" width="8" height="8"/>
    </g><g fill="#ffd247"><rect x="78" y="62" width="8" height="8"/><rect x="172" y="66" width="8" height="8"/><rect x="122" y="18" width="8" height="8"/></g>
  </svg>`);
  return sharp({create: {width: canvas[0], height: canvas[1], channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
    .composite([
      {input: heart, left: Math.round(canvas[0] * 0.14), top: Math.round(canvas[1] * 0.17)},
      {input: particleSvg, left: 0, top: 0}
    ]).png().toBuffer();
}

async function buildAtlas(frameBuffers, canvas, output) {
  await sharp({
    create: {width: canvas[0] * frameBuffers.length, height: canvas[1], channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}
  }).composite(frameBuffers.map((input, index) => ({input, left: index * canvas[0], top: 0}))).png().toFile(output);
}

async function buildPreview(rows) {
  const width = 1600;
  const titleHeight = 72;
  const rowHeight = 200;
  const height = titleHeight + rows.length * rowHeight;
  const composites = [];
  const title = Buffer.from(`<svg width="${width}" height="${titleHeight}"><text x="32" y="48" fill="#ff43bd" font-family="monospace" font-weight="bold" font-size="34">LOVE ON TILT — UI / REWARD RUNTIME ASSETS</text></svg>`);
  composites.push({input: title, left: 0, top: 0});
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = Buffer.from(`<svg width="280" height="${rowHeight}"><text x="24" y="105" fill="#66f6ff" font-family="monospace" font-weight="bold" font-size="21">${row.id.toUpperCase()}</text></svg>`);
    composites.push({input: label, left: 0, top: titleHeight + i * rowHeight});
    const atlas = await sharp(row.atlas).resize({width: 1280, height: 170, fit: 'inside', kernel: 'nearest'}).png().toBuffer();
    const meta = await sharp(atlas).metadata();
    composites.push({input: atlas, left: 290, top: titleHeight + i * rowHeight + Math.floor((rowHeight - meta.height) / 2)});
  }
  await sharp({create: {width, height, channels: 4, background: {r: 8, g: 5, b: 25, alpha: 1}}})
    .composite(composites).png().toFile(path.join(ROOT, 'previews/ui-reward-runtime-assets.png'));
}

await fs.rm(OUTPUT_ROOT, {recursive: true, force: true});
await fs.mkdir(OUTPUT_ROOT, {recursive: true});
const manifest = {
  schema: 'love-on-tilt/ui-runtime-assets@1',
  version: '1.2.0',
  imageRendering: 'pixelated',
  primaryObjective: 'earned-profile-reveals',
  appLevelCosmeticRewards: false,
  arcadeTicketMeaning: 'session-only-bonus-marker',
  achievementBadgeMeaning: 'session-only-callout',
  collections: {}
};
const previewRows = [];

for (const group of groups) {
  const rawFrames = [];
  for (const cell of group.cells) rawFrames.push(await transparentCell(SOURCES[group.source], cell));
  const bounds = rawFrames.map(alphaBounds);
  const union = bounds.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY)
  }), {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity});
  const directory = path.join(OUTPUT_ROOT, group.id);
  await fs.mkdir(directory, {recursive: true});
  const frameBuffers = [];
  const frames = [];
  for (let i = 0; i < rawFrames.length; i++) {
    const frameUnion = group.individualBounds ? bounds[i] : union;
    let buffer = await normalizedFrame(rawFrames[i], frameUnion, group.canvas);
    buffer = await applyTransform(buffer, group.canvas, group.transforms?.[i]);
    let overlays = group.overlays?.[i] ?? null;
    if (group.text?.[i]) overlays = [{text: group.text[i], ...(group.textOptions ?? {})}];
    buffer = await applyLabels(buffer, group.canvas, overlays);
    const filename = `frame-${String(i).padStart(2, '0')}-${group.states[i]}.png`;
    await fs.writeFile(path.join(directory, filename), buffer);
    frameBuffers.push(buffer);
    frames.push({state: group.states[i], file: `${group.id}/${filename}`, label: group.text?.[i] ?? overlays?.map(item => item.text).join(' / ') ?? null});
  }
  const atlas = path.join(directory, 'atlas.png');
  await buildAtlas(frameBuffers, group.canvas, atlas);
  previewRows.push({id: group.id, atlas});
  manifest.collections[group.id] = {
    atlas: `${group.id}/atlas.png`,
    frameSize: {width: group.canvas[0], height: group.canvas[1]},
    frameCount: frames.length,
    fps: group.fps,
    loop: group.loop,
    usage: group.usage,
    values: group.values ?? undefined,
    frames
  };
}

manifest.collections['end-of-ball-panel'].runtimeTextSlots = [
  {id: 'score', x: 0.28, y: 0.7, align: 'center'},
  {id: 'bonus', x: 0.5, y: 0.7, align: 'center'},
  {id: 'total', x: 0.72, y: 0.7, align: 'center'}
];

await fs.writeFile(path.join(OUTPUT_ROOT, 'ui-runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await buildPreview(previewRows);
const frameCount = Object.values(manifest.collections).reduce((sum, collection) => sum + collection.frameCount, 0);
console.log(`Built ${frameCount} transparent UI/reward frames across ${Object.keys(manifest.collections).length} collections.`);
