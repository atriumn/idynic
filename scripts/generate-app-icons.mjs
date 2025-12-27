import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const svgPath = join(root, 'apps/web/public/logo.svg');
const mobileAssets = join(root, 'apps/mobile/assets/images');

// Read SVG
const svgBuffer = readFileSync(svgPath);

// Icon configs: size = canvas size, logoScale = how much of canvas the logo fills
const icons = [
  { name: 'icon.png', size: 1024, logoScale: 0.65 },           // iOS app icon (needs padding for rounded corners)
  { name: 'adaptive-icon.png', size: 1024, logoScale: 0.55 },  // Android adaptive (needs more padding for masking)
  { name: 'splash-icon.png', size: 512, logoScale: 0.6 },      // Splash screen
  { name: 'favicon.png', size: 64, logoScale: 0.85 },          // Web favicon (can be tighter)
];

console.log('Generating app icons from logo.svg...\n');

for (const icon of icons) {
  const outputPath = join(mobileAssets, icon.name);
  const logoSize = Math.round(icon.size * icon.logoScale);
  const padding = Math.round((icon.size - logoSize) / 2);

  // First resize the logo to the scaled size
  const resizedLogo = await sharp(svgBuffer, { density: 300 })
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  // Then place it centered on a transparent canvas
  await sharp({
    create: {
      width: icon.size,
      height: icon.size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resizedLogo, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log(`✓ ${icon.name} (${icon.size}x${icon.size}, logo at ${Math.round(icon.logoScale * 100)}%)`);
}

console.log('\nDone! Icons saved to apps/mobile/assets/images/');
