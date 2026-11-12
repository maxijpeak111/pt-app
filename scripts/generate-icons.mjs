// Turns scripts/icon.svg into the PNG icons the app needs.
// Run with: npm run icons   (after editing icon.svg)
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";

const svg = await readFile(new URL("./icon.svg", import.meta.url));
const root = new URL("../", import.meta.url);

await mkdir(new URL("public/icons/", root), { recursive: true });

const outputs = [
  ["public/icons/icon-192.png", 192], // Android / manifest
  ["public/icons/icon-512.png", 512], // Android / manifest / splash
  ["src/app/apple-icon.png", 180], // iPhone home screen icon
  ["src/app/icon.png", 64], // browser tab icon
];

for (const [path, size] of outputs) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(new URL(path, root).pathname);
  console.log(`created ${path} (${size}x${size})`);
}
