// 压缩 public/verify/images：格子约 104px，@3x 屏需要 312px，所以最长边保持 330 不放大。
// JPEG 兜底改成 progressive + mozjpeg，首选 WebP；页面用 EXT 检测决定取哪一种。
// 用法：cd yen-chiu.github.io && node scripts/optimize-verify-images.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve("public/verify/images");
const MAX_W = 330;

let before = 0;
let afterJpg = 0;
let afterWebp = 0;
const rows = [];

for (const file of fs.readdirSync(DIR)) {
  if (!file.endsWith(".jpg")) continue;
  const full = path.join(DIR, file);
  const stat = fs.statSync(full);
  before += stat.size;

  const input = fs.readFileSync(full);
  const meta = await sharp(input).metadata();
  const pipeline = () => {
    let p = sharp(input).rotate();
    if (meta.width > MAX_W) p = p.resize({ width: MAX_W, withoutEnlargement: true });
    return p;
  };

  const jpg = await pipeline().jpeg({ quality: 74, progressive: true, mozjpeg: true }).toBuffer();
  fs.writeFileSync(full, jpg);
  afterJpg += jpg.length;

  const webp = await pipeline().webp({ quality: 70, effort: 6 }).toBuffer();
  fs.writeFileSync(full.replace(/\.jpg$/, ".webp"), webp);
  afterWebp += webp.length;

  rows.push([file, stat.size, jpg.length, webp.length, `${meta.width}x${meta.height}`]);
}

rows.sort((a, b) => b[1] - a[1]);
console.log("file".padEnd(22), "old".padStart(7), "jpg".padStart(7), "webp".padStart(7), "size");
for (const [f, o, j, w, dim] of rows) {
  console.log(f.padEnd(22), String(o).padStart(7), String(j).padStart(7), String(w).padStart(7), dim);
}
const kb = (n) => (n / 1024).toFixed(0) + "KB";
console.log("\ntotal", kb(before), "-> jpg", kb(afterJpg), "-> webp", kb(afterWebp));
