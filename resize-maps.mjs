// 一次性工具:把 resources/maps 下所有 webp 縮到最多 500x550(維持比例)
import sharp from 'sharp';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = 'resources/maps';
let count = 0, before = 0, after = 0;

for (const realm of readdirSync(root)) {
  const dir = join(root, realm);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.webp')) continue;
    const p = join(dir, f);
    const orig = readFileSync(p);
    const buf = await sharp(orig)
      .resize(500, 550, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    writeFileSync(p, buf);
    const m = await sharp(buf).metadata();
    before += orig.length;
    after += buf.length;
    count++;
    if (count <= 5) console.log(`${m.width}x${m.height}  ${realm}/${f}`);
  }
}

console.log(`\n完成:${count} 張`);
console.log(`容量:${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB (省 ${(100 - after / before * 100).toFixed(0)}%)`);
