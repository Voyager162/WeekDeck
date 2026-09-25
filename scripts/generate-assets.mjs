import { mkdir, writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PanelsTopLeft } from 'lucide-react';
import sharp from 'sharp';

const glyph = renderToStaticMarkup(
  React.createElement(PanelsTopLeft, { size: 20, color: '#ffffff', strokeWidth: 1.7 }),
);
// Match the 29px header mark, including its 7px corners and centered 20px glyph.
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 29 29"><rect width="29" height="29" rx="7" fill="#24705b"/><g transform="translate(4.5 4.5)">${glyph}</g></svg>`,
);
// Mobile launchers apply their own mask, so these variants need an opaque canvas.
const maskable = Buffer.from(svg.toString().replace('rx="7"', 'rx="0"'));
await mkdir('build/icons', { recursive: true });
await mkdir('public/icons', { recursive: true });
await sharp(svg).png().toFile('build/icon.png');
await sharp(svg).resize(64).png().toFile('public/favicon.png');
for (const size of [180, 192, 512])
  await sharp(size === 180 ? maskable : svg)
    .resize(size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
await sharp(maskable).resize(512).png().toFile('public/icons/icon-maskable-512.png');
for (const size of [16, 32, 48, 64, 128, 256, 512, 1024])
  await sharp(svg).resize(size).png().toFile(`build/icons/${size}x${size}.png`);
const images = [];
for (const size of [16, 32, 48, 64, 128, 256])
  images.push({ size, data: await sharp(svg).resize(size).png().toBuffer() });
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(({ size, data }, index) => {
  const start = 6 + index * 16;
  header[start] = size === 256 ? 0 : size;
  header[start + 1] = header[start];
  header.writeUInt16LE(1, start + 4);
  header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(data.length, start + 8);
  header.writeUInt32LE(offset, start + 12);
  offset += data.length;
});
await writeFile('build/icon.ico', Buffer.concat([header, ...images.map((image) => image.data)]));
console.log('Weekdeck desktop and Home Screen icons generated.');
