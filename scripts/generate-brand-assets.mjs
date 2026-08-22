import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourcePath = path.join(
  projectRoot,
  "src/assets/brand/app-icon-source.svg",
);
const publicDirectory = path.join(projectRoot, "public");

const outputs = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["favicon-48x48.png", 48],
  ["icon-96.png", 96],
  ["icon-128.png", 128],
  ["icon-144.png", 144],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-256.png", 256],
  ["icon-384.png", 384],
  ["icon-512.png", 512],
];

const maskableOutputs = [
  ["icon-maskable-192.png", 192],
  ["icon-maskable-512.png", 512],
];

await mkdir(publicDirectory, { recursive: true });
const source = await readFile(sourcePath);

async function render(outputName, size) {
  await sharp(source, { density: 384 })
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: true })
    .toFile(path.join(publicDirectory, outputName));
}

async function renderMaskable(outputName, size) {
  const safeSize = Math.round(size * 0.72);
  const safeSource = await sharp(source, { density: 384 })
    .resize(safeSize, safeSize, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#002a1f",
    },
  })
    .composite([{ input: safeSource, gravity: "centre" }])
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: true })
    .toFile(path.join(publicDirectory, outputName));
}

for (const [outputName, size] of outputs) {
  await render(outputName, size);
}

for (const [outputName, size] of maskableOutputs) {
  await renderMaskable(outputName, size);
}

console.log(
  `Generated ${outputs.length + maskableOutputs.length} brand assets from ${path.relative(projectRoot, sourcePath)}.`,
);
