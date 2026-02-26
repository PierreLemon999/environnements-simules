import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(__dirname, 'static');

// SVG sources
const favicon32 = readFileSync(resolve(staticDir, 'favicon.svg'));
const icon192 = readFileSync(resolve(staticDir, 'icon-192.svg'));
const icon512 = readFileSync(resolve(staticDir, 'icon-512.svg'));

// Apple touch icon (180x180 PNG)
const appleTouchSvg = `<svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" rx="0" fill="white"/>
  <defs>
    <radialGradient id="yg" cx="0.4" cy="0.4" r="0.6">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </radialGradient>
  </defs>
  <path d="M22 56 L22 34 Q22 22 34 22 L56 22" stroke="#3B82F6" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M124 22 L146 22 Q158 22 158 34 L158 56" stroke="#3B82F6" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M158 124 L158 146 Q158 158 146 158 L124 158" stroke="#3B82F6" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M56 158 L34 158 Q22 158 22 146 L22 124" stroke="#3B82F6" stroke-width="7.5" stroke-linecap="round"/>
  <circle cx="90" cy="90" r="22.5" fill="url(#yg)"/>
  <circle cx="90" cy="90" r="22.5" stroke="#F59E0B" stroke-width="2"/>
  <circle cx="90" cy="90" r="36" stroke="#3B82F6" stroke-width="2.5" opacity="0.15"/>
</svg>`;

async function generate() {
  // favicon-32x32.png
  await sharp(favicon32)
    .resize(32, 32)
    .png()
    .toFile(resolve(staticDir, 'favicon-32x32.png'));
  console.log('  favicon-32x32.png');

  // favicon-16x16.png
  await sharp(favicon32)
    .resize(16, 16)
    .png()
    .toFile(resolve(staticDir, 'favicon-16x16.png'));
  console.log('  favicon-16x16.png');

  // apple-touch-icon.png (180x180)
  await sharp(Buffer.from(appleTouchSvg))
    .resize(180, 180)
    .png()
    .toFile(resolve(staticDir, 'apple-touch-icon.png'));
  console.log('  apple-touch-icon.png');

  // icon-192.png
  await sharp(icon192)
    .resize(192, 192)
    .png()
    .toFile(resolve(staticDir, 'icon-192.png'));
  console.log('  icon-192.png');

  // icon-512.png
  await sharp(icon512)
    .resize(512, 512)
    .png()
    .toFile(resolve(staticDir, 'icon-512.png'));
  console.log('  icon-512.png');

  // Generate ICO (32x32 + 16x16 packed as PNG-in-ICO)
  const png16 = await sharp(favicon32).resize(16, 16).png().toBuffer();
  const png32 = await sharp(favicon32).resize(32, 32).png().toBuffer();

  // Build ICO file manually (PNG-in-ICO format)
  const images = [
    { size: 16, data: png16 },
    { size: 32, data: png32 },
  ];
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize * images.length;

  const buffers = [];
  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);       // Reserved
  header.writeUInt16LE(1, 2);       // Type: ICO
  header.writeUInt16LE(images.length, 4); // Count
  buffers.push(header);

  let offset = dataOffset;
  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);  // Width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);  // Height
    entry.writeUInt8(0, 2);          // Color palette
    entry.writeUInt8(0, 3);          // Reserved
    entry.writeUInt16LE(1, 4);       // Color planes
    entry.writeUInt16LE(32, 6);      // Bits per pixel
    entry.writeUInt32LE(img.data.length, 8);  // Size
    entry.writeUInt32LE(offset, 12);          // Offset
    buffers.push(entry);
    offset += img.data.length;
  }

  for (const img of images) {
    buffers.push(img.data);
  }

  writeFileSync(resolve(staticDir, 'favicon.ico'), Buffer.concat(buffers));
  console.log('  favicon.ico');

  console.log('\nAll favicons generated!');
}

generate().catch(console.error);
