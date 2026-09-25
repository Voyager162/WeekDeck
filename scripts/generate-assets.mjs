import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PanelsTopLeft } from 'lucide-react';
import sharp from 'sharp';

const glyph = renderToStaticMarkup(
  React.createElement(PanelsTopLeft, { size: 560, color: '#ffffff', strokeWidth: 1.65 }),
);
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#24705b"/><g transform="translate(232 232)">${glyph}</g></svg>`,
);
const foreground = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><g transform="translate(232 232)">${glyph}</g></svg>`,
);
await mkdir('build/icons', { recursive: true });
await mkdir('public', { recursive: true });
await sharp(svg).png().toFile('build/icon.png');
await sharp(svg).resize(64).png().toFile('public/favicon.png');
for (const size of [16, 32, 48, 64, 128, 256, 512, 1024])
  await sharp(svg).resize(size).png().toFile(`build/icons/${size}x${size}.png`);
const icoImages = [];
for (const size of [16, 32, 48, 64, 128, 256])
  icoImages.push({ size, data: await sharp(svg).resize(size).png().toBuffer() });
const icoHeader = Buffer.alloc(6 + icoImages.length * 16);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoImages.length, 4);
let offset = icoHeader.length;
icoImages.forEach(({ size, data }, index) => {
  const start = 6 + index * 16;
  icoHeader[start] = size === 256 ? 0 : size;
  icoHeader[start + 1] = icoHeader[start];
  icoHeader.writeUInt16LE(1, start + 4);
  icoHeader.writeUInt16LE(32, start + 6);
  icoHeader.writeUInt32LE(data.length, start + 8);
  icoHeader.writeUInt32LE(offset, start + 12);
  offset += data.length;
});
await writeFile(
  'build/icon.ico',
  Buffer.concat([icoHeader, ...icoImages.map((image) => image.data)]),
);

if (process.argv.includes('android')) {
  const res = 'android/app/src/main/res';
  for (const [density, size, frontSize] of [
    ['mdpi', 48, 108],
    ['hdpi', 72, 162],
    ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324],
    ['xxxhdpi', 192, 432],
  ]) {
    for (const name of ['ic_launcher', 'ic_launcher_round'])
      await sharp(svg).resize(size).png().toFile(`${res}/mipmap-${density}/${name}.png`);
    await sharp(foreground)
      .resize(frontSize)
      .png()
      .toFile(`${res}/mipmap-${density}/ic_launcher_foreground.png`);
  }
  for (const directory of await readdir(res)) {
    if (!directory.startsWith('drawable')) continue;
    const file = join(res, directory, 'splash.png');
    try {
      const { width, height } = await sharp(file).metadata();
      const icon = await sharp(svg)
        .resize(Math.round(Math.min(width, height) * 0.18))
        .png()
        .toBuffer();
      const splash = await sharp({ create: { width, height, channels: 3, background: '#f7f9f8' } })
        .composite([{ input: icon }])
        .png()
        .toBuffer();
      await writeFile(file, splash);
    } catch (error) {
      if (!error.message.includes('missing')) throw error;
    }
  }
}
if (process.argv.includes('ios')) {
  if (process.platform !== 'darwin')
    throw new Error('Generate iOS resources on macOS with Swift installed.');
  execFileSync('swift', ['--version'], { stdio: 'inherit' });
  await sharp(svg)
    .png()
    .toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  const icon = await sharp(svg).resize(400).png().toBuffer();
  const splash = await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: '#f7f9f8' },
  })
    .composite([{ input: icon }])
    .png()
    .toBuffer();
  for (const suffix of ['', '-1', '-2'])
    await writeFile(
      `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${suffix}.png`,
      splash,
    );
}
console.log('Weekdeck icons generated from the existing Lucide brand mark.');
