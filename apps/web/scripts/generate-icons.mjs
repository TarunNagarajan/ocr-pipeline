import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const iconsDir = resolve(projectRoot, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

const svgBuffer = readFileSync(resolve(iconsDir, "icon.svg"));

const sizes = [192, 512];

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(iconsDir, `icon-${size}x${size}.png`));

  // Also generate a maskable version with padding
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 99, g: 102, b: 241, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(svgBuffer)
          .resize(Math.round(size * 0.8), Math.round(size * 0.8))
          .png()
          .toBuffer(),
        top: Math.round(size * 0.1),
        left: Math.round(size * 0.1),
      },
    ])
    .png()
    .toFile(resolve(iconsDir, `icon-${size}x${size}-maskable.png`));

  console.log(`Generated ${size}x${size} icons`);
}

console.log("All icons generated in public/icons/");
