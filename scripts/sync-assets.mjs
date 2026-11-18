import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');
const MPWSP_SRC = '/Users/krding/Downloads/MPWSP01/tileset/tileset.png';
const PVFX_SRC =
  '/Users/krding/Downloads/pvfx-foundry-thirteen-spritesheets/effects';

const POKEMON_IDS = [
  '0025', // Pikachu
  '0001', // Bulbasaur
  '0004', // Charmander
  '0007', // Squirtle
  '0143', // Snorlax
  '0094', // Gengar
  '0074', // Geodude
  '0012', // Butterfree
  '0133', // Eevee
  '0448', // Lucario
  '0019', // Rattata
  '0041', // Zubat
  '0050', // Diglett
  '0063', // Abra
];

const PVFX_EFFECTS = [
  'lightning/lightning-strike',
  'projectiles/lightning-bolt-flight',
  'projectiles/lightning-bolt-impact',
  'projectiles/fireball-flight',
  'fire/fireball-impact',
  'projectiles/water-bolt-flight',
  'water/water-splash',
  'water/tidal-wave',
  'nature/bloom-heal',
  'nature/boulder-toss',
  'impacts/rock-shatter',
  'shadow/shadow-bolt',
  'shadow/void-implosion',
  'melee/sword-combo',
  'melee/dagger-slash',
  'holy/holy-heal',
  'explosions/small-explosion',
  'explosions/big-explosion',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// 1. Copy MPWSP01 tileset
ensureDir(path.join(PUBLIC_ASSETS, 'tiles'));
fs.copyFileSync(
  MPWSP_SRC,
  path.join(PUBLIC_ASSETS, 'tiles', 'mpwsp01-tileset.png'),
);
console.log('Copied MPWSP01 tileset.');

// 2. Copy PVFX Foundry effects & build manifest
const vfxManifest = {};
for (const eff of PVFX_EFFECTS) {
  const srcDir = path.join(PVFX_SRC, eff, 'lit', 'grid');
  const destDir = path.join(PUBLIC_ASSETS, 'vfx', eff);
  ensureDir(destDir);
  fs.copyFileSync(
    path.join(srcDir, 'sprite-sheet.png'),
    path.join(destDir, 'sprite-sheet.png'),
  );
  const rawManifest = JSON.parse(
    fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'),
  );
  const [frameWidth, frameHeight] = rawManifest.source_size;
  const frames = rawManifest.frames.length;
  const frameRate = Math.max(
    8,
    Math.round(1000 / (rawManifest.frames[0]?.duration?.numerator_ms ?? 70)),
  );
  vfxManifest[eff] = {
    path: `assets/vfx/${eff}/sprite-sheet.png`,
    frameWidth,
    frameHeight,
    frames,
    frameRate,
    loop: rawManifest.loop_mode === 'loop',
  };
}
fs.writeFileSync(
  path.join(PUBLIC_ASSETS, 'vfx', 'manifest.json'),
  JSON.stringify(vfxManifest, null, 2),
);
console.log(`Copied ${PVFX_EFFECTS.length} PVFX effects.`);

// 3. Download PMDCollab sprites & parse AnimData.xml
function parseAnimXml(xml) {
  const anims = {};
  const animBlocks = xml.match(/<Anim>[\s\S]*?<\/Anim>/g) ?? [];
  for (const block of animBlocks) {
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    const fw = Number(block.match(/<FrameWidth>(\d+)<\/FrameWidth>/)?.[1] ?? 0);
    const fh = Number(
      block.match(/<FrameHeight>(\d+)<\/FrameHeight>/)?.[1] ?? 0,
    );
    const durations = [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(
      (m) => Number(m[1]),
    );
    if (name && fw > 0 && fh > 0 && durations.length > 0) {
      anims[name] = {
        frameWidth: fw,
        frameHeight: fh,
        frames: durations.length,
        frameRate: Math.max(
          4,
          Math.round(
            60 / (durations.reduce((a, b) => a + b, 0) / durations.length),
          ),
        ),
      };
    }
  }
  return anims;
}

const pokeManifest = {};
for (const id of POKEMON_IDS) {
  const destDir = path.join(PUBLIC_ASSETS, 'pokemon', id);
  ensureDir(destDir);
  const baseUrl = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${id}`;
  const files = [
    'AnimData.xml',
    'Walk-Anim.png',
    'Idle-Anim.png',
    'Attack-Anim.png',
  ];
  for (const f of files) {
    const out = path.join(destDir, f);
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
      execFileSync('curl', ['-fsSL', `${baseUrl}/${f}`, '-o', out]);
    }
  }
  const xml = fs.readFileSync(path.join(destDir, 'AnimData.xml'), 'utf8');
  const parsed = parseAnimXml(xml);
  pokeManifest[id] = {
    Walk: parsed.Walk ?? null,
    Idle: parsed.Idle ?? null,
    Attack: parsed.Attack ?? null,
  };
  console.log(`Synced PMD sprite ${id}`);
}
fs.writeFileSync(
  path.join(PUBLIC_ASSETS, 'pokemon', 'manifest.json'),
  JSON.stringify(pokeManifest, null, 2),
);
console.log('Done syncing all assets.');
