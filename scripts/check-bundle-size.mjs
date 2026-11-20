import fs from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
if (!fs.existsSync(distAssetsDir)) {
  console.error(`Missing ${distAssetsDir}. Run "npm run build" first.`);
  process.exit(1);
}

const files = fs.readdirSync(distAssetsDir);

const budgets = [
  { label: 'app JS', pattern: /^index-.*\.js$/, maxKb: 250 },
  { label: 'game-data JS', pattern: /^game-data-.*\.js$/, maxKb: 250 },
  { label: 'app CSS', pattern: /^index-.*\.css$/, maxKb: 70 },
];

let failed = false;
for (const { label, pattern, maxKb } of budgets) {
  const match = files.find((f) => pattern.test(f));
  if (!match) {
    console.error(`Missing ${label} bundle matching ${pattern} in dist/assets`);
    failed = true;
    continue;
  }
  const bytes = fs.statSync(path.join(distAssetsDir, match)).size;
  const kb = bytes / 1024;
  console.log(`${label}: ${match} = ${kb.toFixed(2)} kB (budget: ${maxKb} kB)`);
  if (kb > maxKb) {
    console.error(
      `Bundle budget exceeded for ${label}: ${kb.toFixed(2)} kB > ${maxKb} kB`,
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
