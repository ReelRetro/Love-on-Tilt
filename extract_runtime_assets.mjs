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
const BACKGROUND_MIN = 205;
const BACKGROUND_CHROMA = 36;

const boards = [
  {
    id: 'table-for-two',
    title: 'Table for Two',
    targetWord: 'CHEERS',
    mechanisms: 'source/table-for-two-mechanisms-master.png',
    features: 'source/table-for-two-features-master.png',
    board: 'boards/table-for-two.png',
    themeNotes: 'Rose-gold dinner hardware, plate bumpers, reservation-card targets, and a heart-shaped booth door.'
  },
  {
    id: 'reel-romance',
    title: 'Reel Romance',
    targetWord: 'REEL',
    mechanisms: 'source/reel-romance-mechanisms-master.png',
    features: 'source/reel-romance-features-master.png',
    board: 'boards/reel-romance.png',
    themeNotes: 'Cinema hardware, popcorn bumpers, marquee targets, and a heart screen behind red curtains.'
  },
  {
    id: 'bad-date-ghosted',
    title: 'Bad Date: Ghosted',
    targetWord: 'GHOSTED',
    mechanisms: 'source/bad-date-ghosted-mechanisms-master.png',
    features: 'source/bad-date-ghosted-features-master.png',
    board: 'boards/bad-date-ghosted.png',
    themeNotes: 'Bone and graveyard hardware, skull-pumpkin bumpers, tombstone targets, and a ghost-filled cemetery gate.'
  }
];

const groups = [
  {
    id: 'ball', source: 'mechanisms', cells: [0, 1, 2, 3], canvas: [192, 192], fps: 12, loop: true,
    states: ['spin-0', 'spin-1', 'spin-2', 'spin-3'], pivot: [0.5, 0.5]
  },
  {
    id: 'flipper-left', source: 'mechanisms', cells: [4, 5, 6], canvas: [320, 320], fps: 18, loop: false,
    states: ['rest', 'mid', 'up'], pivot: [0.2, 0.66]
  },
  {
    id: 'flipper-right', source: 'mechanisms', cells: [7, 8, 9], canvas: [320, 320], fps: 18, loop: false,
    states: ['rest', 'mid', 'up'], pivot: [0.8, 0.66]
  },
  {
    id: 'plunger', source: 'mechanisms', cells: [10, 11, 12], canvas: [320, 320], fps: 12, loop: false,
    states: ['rest', 'half-pull', 'full-pull'], pivot: [0.5, 0.92]
  },
  {
    id: 'bumper', source: 'features', cells: [0, 1, 2, 3], canvas: [320, 320], fps: 14, loop: false,
    states: ['idle', 'anticipation', 'impact', 'recovery'], pivot: [0.5, 0.56]
  },
  {
    id: 'target', source: 'features', cells: [4, 5, 6, 7], canvas: [320, 320], fps: 12, loop: false,
    states: ['raised-unlit', 'raised-lit', 'halfway-down', 'down'], pivot: [0.5, 0.86]
  },
  {
    id: 'light', source: 'features', cells: [14, 15, 15], canvas: [192, 192], fps: 6, loop: true,
    states: ['off', 'on', 'pulse'], pivot: [0.5, 0.5], transforms: [null, null, 'pulse']
  },
  {
    id: 'jackpot-door', source: 'features', cells: [8, 9, 10, 11, 12, 13], canvas: [384, 384], fps: 10, loop: false,
    states: ['closed', 'cracked', 'half-open', 'open', 'open-glow', 'jackpot-flash'], pivot: [0.5, 0.82]
  }
];

function isBackground(r, g, b) {
  return Math.min(r, g, b) >= BACKGROUND_MIN && Math.max(r, g, b) - Math.min(r, g, b) <= BACKGROUND_CHROMA;
}

function removeDetachedArtifacts(frame, componentType) {
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
  const nearPrimary = component => {
    const margin = componentType === 'bumper' ? 40 : componentType.startsWith('flipper') ? 8 : 22;
    return component.maxX >= primary.minX - margin && component.minX <= primary.maxX + margin &&
      component.maxY >= primary.minY - margin && component.minY <= primary.maxY + margin;
  };
  for (const component of components.slice(1)) {
    const minimumRatio = componentType.startsWith('flipper') ? 0.35 : 0.12;
    const keep = component.area >= primary.area * minimumRatio || nearPrimary(component);
    if (!keep) {
      for (const index of component.members) frame.data[index * 4 + 3] = 0;
    }
  }
  return frame;
}

async function transparentCell(file, cellIndex, componentType) {
  const image = sharp(file);
  const meta = await image.metadata();
  const col = cellIndex % GRID;
  const row = Math.floor(cellIndex / GRID);
  const left = Math.floor(col * meta.width / GRID);
  const top = Math.floor(row * meta.height / GRID);
  const right = Math.floor((col + 1) * meta.width / GRID);
  const bottom = Math.floor((row + 1) * meta.height / GRID);
  const width = right - left;
  const height = bottom - top;
  const {data, info} = await image
    .extract({left, top, width, height})
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});

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

  const neighbors = [-1, 0, 1];
  while (head < tail) {
    const index = queue[head++];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    for (const dy of neighbors) {
      for (const dx of neighbors) {
        if (dx || dy) enqueue(x + dx, y + dy);
      }
    }
  }

  for (let i = 0; i < pixels; i++) {
    if (visited[i]) data[i * 4 + 3] = 0;
  }

  return removeDetachedArtifacts({data, width: info.width, height: info.height}, componentType);
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
  if (maxX < minX || maxY < minY) throw new Error('No foreground pixels found in extracted cell.');
  return {minX, minY, maxX, maxY};
}

async function normalizedFrame(frame, union, canvas, transform) {
  const cropWidth = union.maxX - union.minX + 1;
  const cropHeight = union.maxY - union.minY + 1;
  const padding = 20;
  const scale = Math.min(1, (canvas[0] - padding * 2) / cropWidth, (canvas[1] - padding * 2) / cropHeight);
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
  let pipeline = sharp(sourceData, {raw: {width: paddedWidth, height: paddedHeight, channels: 4}});
  pipeline = pipeline.extract({left: union.minX, top: union.minY, width: cropWidth, height: cropHeight});
  if (scale !== 1) pipeline = pipeline.resize(outWidth, outHeight, {kernel: 'nearest'});
  if (transform === 'pulse') pipeline = pipeline.modulate({brightness: 1.28, saturation: 1.12});
  const rendered = await pipeline.png().toBuffer();

  return sharp({
    create: {width: canvas[0], height: canvas[1], channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}
  }).composite([{
    input: rendered,
    left: Math.floor((canvas[0] - outWidth) / 2),
    top: Math.floor((canvas[1] - outHeight) / 2)
  }]).png().toBuffer();
}

async function buildAtlas(frameBuffers, canvas, output) {
  const width = canvas[0] * frameBuffers.length;
  const height = canvas[1];
  const composites = frameBuffers.map((input, index) => ({input, left: index * canvas[0], top: 0}));
  await sharp({
    create: {width, height, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}
  }).composite(composites).png().toFile(output);
}

async function buildPreview(board, outputRows, output) {
  const titleHeight = 64;
  const rowHeight = 180;
  const width = 1200;
  const height = titleHeight + rowHeight * outputRows.length;
  const base = sharp({
    create: {width, height, channels: 4, background: {r: 8, g: 5, b: 25, alpha: 1}}
  });
  const composites = [];
  const title = Buffer.from(`<svg width="${width}" height="${titleHeight}"><rect width="100%" height="100%" fill="#080519"/><text x="32" y="43" fill="#ff43bd" font-family="monospace" font-weight="bold" font-size="32">${board.title.toUpperCase()} — RUNTIME ASSETS</text></svg>`);
  composites.push({input: title, left: 0, top: 0});
  for (let i = 0; i < outputRows.length; i++) {
    const row = outputRows[i];
    const label = Buffer.from(`<svg width="230" height="${rowHeight}"><text x="22" y="96" fill="#66f6ff" font-family="monospace" font-weight="bold" font-size="22">${row.group.toUpperCase()}</text></svg>`);
    composites.push({input: label, left: 0, top: titleHeight + i * rowHeight});
    const atlas = await sharp(row.atlas).resize({height: 150, kernel: 'nearest'}).png().toBuffer();
    composites.push({input: atlas, left: 230, top: titleHeight + i * rowHeight + 15});
  }
  await base.composite(composites).png().toFile(output);
}

async function buildBoard(board) {
  const outRoot = path.join(ROOT, 'assets', board.id);
  await fs.rm(outRoot, {recursive: true, force: true});
  await fs.mkdir(outRoot, {recursive: true});
  const manifest = {
    schema: 'love-on-tilt/runtime-assets@1',
    boardId: board.id,
    title: board.title,
    boardAsset: `../../${board.board}`,
    imageRendering: 'pixelated',
    units: 'pixels',
    targetLabels: [...board.targetWord],
    targetLabelMode: 'runtime-overlay',
    themeNotes: board.themeNotes,
    animations: {}
  };
  const previewRows = [];

  for (const group of groups) {
    const source = path.join(ROOT, board[group.source]);
    const rawFrames = [];
    for (const cell of group.cells) rawFrames.push(await transparentCell(source, cell, group.id));
    const bounds = rawFrames.map(alphaBounds);
    const union = bounds.reduce((acc, b) => ({
      minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY),
      maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY)
    }), {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity});

    const groupDir = path.join(outRoot, group.id);
    await fs.mkdir(groupDir, {recursive: true});
    const frameBuffers = [];
    const frameEntries = [];
    for (let i = 0; i < rawFrames.length; i++) {
      const buffer = await normalizedFrame(rawFrames[i], union, group.canvas, group.transforms?.[i]);
      const filename = `frame-${String(i).padStart(2, '0')}-${group.states[i]}.png`;
      await fs.writeFile(path.join(groupDir, filename), buffer);
      frameBuffers.push(buffer);
      frameEntries.push({state: group.states[i], file: `${group.id}/${filename}`});
    }
    const atlasPath = path.join(groupDir, 'atlas.png');
    await buildAtlas(frameBuffers, group.canvas, atlasPath);
    previewRows.push({group: group.id, atlas: atlasPath});

    manifest.animations[group.id] = {
      atlas: `${group.id}/atlas.png`,
      frameSize: {width: group.canvas[0], height: group.canvas[1]},
      frameCount: frameBuffers.length,
      fps: group.fps,
      loop: group.loop,
      pivot: {x: group.pivot[0], y: group.pivot[1]},
      frames: frameEntries
    };
  }

  await fs.writeFile(path.join(outRoot, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await buildPreview(board, previewRows, path.join(ROOT, 'previews', `${board.id}-runtime-assets.png`));
  return manifest;
}

await fs.mkdir(path.join(ROOT, 'previews'), {recursive: true});
const manifests = [];
for (const board of boards) manifests.push(await buildBoard(board));

const catalog = {
  schema: 'love-on-tilt/runtime-catalog@1',
  version: '1.3.0',
  boardCount: boards.length,
  componentTypes: groups.map(group => group.id),
  generatedFrameCount: boards.length * groups.reduce((sum, group) => sum + group.cells.length, 0),
  uiFrameCount: 53,
  totalFrameCount: boards.length * groups.reduce((sum, group) => sum + group.cells.length, 0) + 53,
  gameplayFlow: 'gameplay-flow.json',
  readableGameplayGuide: 'GAMEPLAY-FLOW.md',
  profileRevealContract: 'integration/profile-reveal-contract.json',
  uiEffectsManifest: 'assets/ui-common/ui-runtime-manifest.json',
  uiEffectsGuide: 'UI-ASSET-GUIDE.md',
  uiEffectsPreview: 'previews/ui-reward-runtime-assets.png',
  physicsPlayfieldCatalog: 'playfields/playfield-catalog.json',
  physicsPlayfieldGuide: 'PHYSICS-PLAYFIELD-GUIDE.md',
  physicsDebugPreview: 'previews/physics-playfields-debug.png',
  foregroundOcclusionPreview: 'previews/foreground-occlusion-debug.png',
  boards: manifests.map(manifest => ({
    id: manifest.boardId,
    title: manifest.title,
    manifest: `assets/${manifest.boardId}/runtime-manifest.json`,
    preview: `previews/${manifest.boardId}-runtime-assets.png`
  }))
};
await fs.writeFile(path.join(ROOT, 'runtime-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Built ${catalog.generatedFrameCount} transparent frames across ${catalog.boardCount} boards.`);
