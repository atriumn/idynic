import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const svgPath = join(root, 'apps/web/public/logo.svg');
const mobileAssets = join(root, 'apps/mobile/assets/images');

// Read SVG
const svgBuffer = readFileSync(svgPath);

// Icon sizes needed
const icons = [
  { name: 'icon.png', size: 1024 },           // iOS app icon
  { name: 'adaptive-icon.png', size: 1024 },  // Android adaptive foreground
  { name: 'splash-icon.png', size: 512 },     // Splash screen
  { name: 'favicon.png', size: 64 },          // Web favicon
];

console.log('Generating app icons from logo.svg...\n');

for (const icon of icons) {
  const outputPath = join(mobileAssets, icon.name);
  
  await sharp(svgBuffer, { density: 300 })
    .resize(icon.size, icon.size, { 
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent
    })
    .png()
    .toFile(outputPath);
  
  console.log(`✓ ${icon.name} (${icon.size}x${icon.size})`);
}

console.log('\nDone! Icons saved to apps/mobile/assets/images/');
