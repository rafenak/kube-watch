const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/k8s-logo.svg');
const iconsetDir = path.join(__dirname, '../assets/icon.iconset');

if (!fs.existsSync(iconsetDir)) fs.mkdirSync(iconsetDir, { recursive: true });

const sizes = [16, 32, 64, 128, 256, 512, 1024];

async function run() {
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate all PNG sizes for macOS iconset
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));
    console.log(`✓ icon_${size}x${size}.png`);

    if (size <= 512) {
      await sharp(svgBuffer)
        .resize(size * 2, size * 2)
        .png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
      console.log(`✓ icon_${size}x${size}@2x.png`);
    }
  }

  // Generate icon.png for Linux
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, '../assets/icon.png'));
  console.log('✓ icon.png (Linux)');

  // Generate Windows ICO (embed multiple PNG sizes)
  const icoSizes = [16, 32, 48, 256];
  const images = [];
  for (const size of icoSizes) {
    const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    images.push({ size, buf });
  }

  const num = images.length;
  const headerSize = 6 + num * 16;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(num, 4);

  const entries = Buffer.alloc(num * 16);
  const dataBuffers = [];
  images.forEach(({ size, buf }, i) => {
    const entry = entries.slice(i * 16, (i + 1) * 16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    dataBuffers.push(buf);
  });

  const ico = Buffer.concat([header, entries, ...dataBuffers]);
  fs.writeFileSync(path.join(__dirname, '../assets/icon.ico'), ico);
  console.log('✓ icon.ico (Windows)');

  console.log('\nAll icons generated. Now run:');
  console.log('  iconutil -c icns assets/icon.iconset -o assets/icon.icns');
}

run().catch(err => { console.error(err); process.exit(1); });
