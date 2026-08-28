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
const catalog = JSON.parse(await fs.readFile(path.join(ROOT, 'runtime-catalog.json'), 'utf8'));
const gameplay = JSON.parse(await fs.readFile(path.join(ROOT, catalog.gameplayFlow), 'utf8'));
const profileContract = JSON.parse(await fs.readFile(path.join(ROOT, catalog.profileRevealContract), 'utf8'));
const uiManifest = JSON.parse(await fs.readFile(path.join(ROOT, catalog.uiEffectsManifest), 'utf8'));
const playfieldCatalog = JSON.parse(await fs.readFile(path.join(ROOT, catalog.physicsPlayfieldCatalog), 'utf8'));
const errors = [];
let checkedFrames = 0;
let checkedAtlases = 0;
let checkedUiFrames = 0;
let checkedUiAtlases = 0;
let checkedPlayfields = 0;

for (const board of catalog.boards) {
  const manifestPath = path.join(ROOT, board.manifest);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const boardRoot = path.dirname(manifestPath);
  for (const [name, animation] of Object.entries(manifest.animations)) {
    const atlasPath = path.join(boardRoot, animation.atlas);
    const atlas = await sharp(atlasPath).metadata();
    checkedAtlases++;
    if (atlas.width !== animation.frameSize.width * animation.frameCount || atlas.height !== animation.frameSize.height) {
      errors.push(`${board.id}/${name}: atlas dimensions do not match manifest.`);
    }
    if (!atlas.hasAlpha) errors.push(`${board.id}/${name}: atlas has no alpha channel.`);
    for (const frame of animation.frames) {
      const framePath = path.join(boardRoot, frame.file);
      const meta = await sharp(framePath).metadata();
      const stats = await sharp(framePath).stats();
      checkedFrames++;
      if (meta.width !== animation.frameSize.width || meta.height !== animation.frameSize.height) {
        errors.push(`${board.id}/${frame.file}: incorrect canvas dimensions.`);
      }
      if (!meta.hasAlpha || stats.channels.length < 4) {
        errors.push(`${board.id}/${frame.file}: missing alpha channel.`);
      } else {
        const alpha = stats.channels[3];
        if (alpha.min !== 0) errors.push(`${board.id}/${frame.file}: background is not transparent.`);
        if (alpha.max === 0) errors.push(`${board.id}/${frame.file}: frame is completely transparent.`);
      }
    }
  }
}

for (const [name, collection] of Object.entries(uiManifest.collections)) {
  const collectionRoot = path.join(ROOT, 'assets/ui-common');
  const atlasPath = path.join(collectionRoot, collection.atlas);
  const atlas = await sharp(atlasPath).metadata();
  checkedUiAtlases++;
  if (atlas.width !== collection.frameSize.width * collection.frameCount || atlas.height !== collection.frameSize.height) {
    errors.push(`ui-common/${name}: atlas dimensions do not match manifest.`);
  }
  if (!atlas.hasAlpha) errors.push(`ui-common/${name}: atlas has no alpha channel.`);
  for (const frame of collection.frames) {
    const framePath = path.join(collectionRoot, frame.file);
    const meta = await sharp(framePath).metadata();
    const stats = await sharp(framePath).stats();
    checkedUiFrames++;
    if (meta.width !== collection.frameSize.width || meta.height !== collection.frameSize.height) {
      errors.push(`ui-common/${frame.file}: incorrect canvas dimensions.`);
    }
    if (!meta.hasAlpha || stats.channels.length < 4) {
      errors.push(`ui-common/${frame.file}: missing alpha channel.`);
    } else {
      const alpha = stats.channels[3];
      if (alpha.min !== 0) errors.push(`ui-common/${frame.file}: background is not transparent.`);
      if (alpha.max === 0) errors.push(`ui-common/${frame.file}: frame is completely transparent.`);
    }
  }
}

const geometryFingerprints = new Set();
const normalizedValues = value => {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(normalizedValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(normalizedValues);
  return [];
};
for (const entry of playfieldCatalog.boards) {
  const manifestPath = path.join(ROOT, 'playfields', entry.manifest);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const directory = path.dirname(manifestPath);
  checkedPlayfields++;
  if (manifest.canvas.width !== 1024 || manifest.canvas.height !== 1536) errors.push(`${entry.id}: unexpected playfield canvas size.`);
  if (manifest.bumpers.length < 3) errors.push(`${entry.id}: insufficient bumper geometry.`);
  if (manifest.flippers.length < 2) errors.push(`${entry.id}: insufficient flipper geometry.`);
  if (!manifest.drains.length) errors.push(`${entry.id}: no drain sensors.`);
  if (manifest.sensors.filter(sensor => sensor.event === 'profileRevealDoor').length !== 1) errors.push(`${entry.id}: must contain exactly one profileRevealDoor sensor.`);
  const values = normalizedValues(manifest.normalized);
  if (values.some(value => value < 0 || value > 1)) errors.push(`${entry.id}: normalized geometry is outside the 0–1 range.`);
  geometryFingerprints.add(JSON.stringify({walls: manifest.walls, bumpers: manifest.bumpers, targets: manifest.targets, sensors: manifest.sensors}));
  for (const filename of ['collision-mask.png', 'collision-debug.png', 'foreground-mask.png', 'foreground-overlay.png']) {
    const imagePath = path.join(directory, filename);
    const meta = await sharp(imagePath).metadata();
    if (meta.width !== 1024 || meta.height !== 1536) errors.push(`${entry.id}/${filename}: incorrect dimensions.`);
    if (filename === 'foreground-overlay.png') {
      const stats = await sharp(imagePath).stats();
      if (!meta.hasAlpha || stats.channels.length < 4 || stats.channels[3].min !== 0 || stats.channels[3].max !== 255) {
        errors.push(`${entry.id}/${filename}: must contain both transparent and opaque pixels.`);
      }
    }
  }
  await fs.access(path.resolve(directory, manifest.sourceArtwork));
}

if (catalog.componentTypes.length !== 8) errors.push('Catalog does not contain all eight required component types.');
if (catalog.boardCount !== 3) errors.push('Catalog does not contain all three approved boards.');
if (gameplay.primaryObjective.type !== 'earned-profile-reveals') errors.push('Profile reveals are not configured as the primary objective.');
if (gameplay.primaryObjective.targetPerSession !== 3) errors.push('Profile reveal target must be three per session.');
if (gameplay.session.startingBalls !== 3 || gameplay.session.maximumExtraBalls !== 2) errors.push('Ball economy does not match the approved 3 + 2 rule.');
if (gameplay.appLevelCosmeticRewards !== false) errors.push('App-level cosmetic rewards must remain disabled.');
if (!gameplay.reveal.decisionActions.some(action => action.id === 'INTERESTED')) errors.push('INTERESTED profile action is missing.');
if (!gameplay.reveal.decisionActions.some(action => action.id === 'KEEP_PLAYING')) errors.push('KEEP PLAYING profile action is missing.');
if (!profileContract.gameToHost.some(item => item.event === 'loveOnTilt.profileRevealEarned')) errors.push('Profile reveal earned event is missing.');
if (!profileContract.gameToHost.some(item => item.event === 'loveOnTilt.profileDecision')) errors.push('Profile decision event is missing.');
const requiredUiCollections = ['extra-ball', 'ball-save', 'chemistry-meter', 'multiplier', 'double-date-multiball', 'arcade-ticket', 'heart-collectible', 'jackpot-numeral', 'reward-banner', 'achievement-badge', 'end-of-ball-panel'];
for (const name of requiredUiCollections) if (!uiManifest.collections[name]) errors.push(`Required UI collection missing: ${name}.`);
if (checkedUiFrames !== 53) errors.push(`UI frame inventory must contain 53 frames; found ${checkedUiFrames}.`);
if (uiManifest.appLevelCosmeticRewards !== false) errors.push('UI manifest must keep app-level cosmetic rewards disabled.');
if (uiManifest.arcadeTicketMeaning !== 'session-only-bonus-marker') errors.push('Arcade Ticket must remain session-only.');
if (uiManifest.achievementBadgeMeaning !== 'session-only-callout') errors.push('Achievement badges must remain session-only.');
if (checkedPlayfields !== 3) errors.push(`Expected three physics playfields; found ${checkedPlayfields}.`);
if (geometryFingerprints.size !== 3) errors.push('Physics geometry must be distinct for all three boards.');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${checkedFrames + checkedUiFrames} frames, ${checkedAtlases + checkedUiAtlases} atlases, and ${checkedPlayfields} distinct physics playfields validated.`);
