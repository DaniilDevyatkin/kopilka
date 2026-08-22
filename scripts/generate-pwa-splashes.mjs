import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const projectRoot = process.cwd();
const source = path.join(projectRoot, "public", "logo-macbookus.png");
const outputDirectory = path.join(projectRoot, "public", "pwa");
const sizes = [
  [750, 1334],
  [828, 1792],
  [1170, 2532],
  [1179, 2556],
  [1290, 2796],
];

await mkdir(outputDirectory, { recursive: true });

for (const [width, height] of sizes) {
  const markSize = Math.round(Math.min(width, height) * 0.2);
  const mark = await sharp(source)
    .resize(markSize, markSize, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#0d1513",
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDirectory, `splash-${width}x${height}.png`));
}

console.log(
  `Generated ${sizes.length} PWA launch screens in ${outputDirectory}`,
);
