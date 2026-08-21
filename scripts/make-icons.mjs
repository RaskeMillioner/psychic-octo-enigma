/**
 * Renders the app icons into public/ — no image dependencies, just geometry and
 * a minimal PNG writer. Run with `npm run icons` after changing the artwork.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (name) => path.join(here, '..', 'public', name);

const BG = [22, 17, 15, 255];
const GLASS = [245, 236, 232, 255];
const WINE = [165, 32, 60, 255];

/** The two themes, for the iOS launch images — see `splash` below. */
const THEMES = {
  dark: { bg: BG, glass: GLASS },
  light: { bg: [247, 242, 238, 255], glass: [28, 21, 18, 255] },
};

/** Signed coverage of the glass silhouette at a point, in a 512-unit space. */
const inBowl = (x, y) => (x - 256) ** 2 + (y - 205) ** 2 <= 118 ** 2 && y >= 132;
const inLiquid = (x, y) => inBowl(x, y) && y >= 196;
const inStem = (x, y) => Math.abs(x - 256) <= 13 && y > 318 && y <= 402;
const inBase = (x, y) => ((x - 256) / 80) ** 2 + ((y - 412) / 19) ** 2 <= 1;

const sample = (x, y) => {
  if (inLiquid(x, y)) return WINE;
  if (inBowl(x, y) || inStem(x, y) || inBase(x, y)) return GLASS;
  return null;
};

const render = (size, inset = 0) => {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = 512 / (size * (1 - 2 * inset));
  const offset = -inset * size * scale;
  const SS = 3; // 3x3 supersampling for smooth edges

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) * scale + offset;
          const y = (py + (sy + 0.5) / SS) * scale + offset;
          const colour = sample(x, y) ?? BG;
          r += colour[0];
          g += colour[1];
          b += colour[2];
        }
      }
      const n = SS * SS;
      const index = (py * size + px) * 4;
      pixels[index] = Math.round(r / n);
      pixels[index + 1] = Math.round(g / n);
      pixels[index + 2] = Math.round(b / n);
      pixels[index + 3] = 255;
    }
  }
  return pixels;
};

/* ------------------------------------------------------------ PNG writing */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const png = (width, height, pixels) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // no per-scanline filter
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const files = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  // Maskable icons need their artwork inside the safe zone.
  ['icon-maskable-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0.06],
];

for (const [name, size, inset] of files) {
  writeFileSync(out(name), png(size, size, render(size, inset)));
  console.log(`wrote public/${name} (${size}px)`);
}

/* --------------------------------------------------------- iOS launch art */

/**
 * A Home Screen app shows an `apple-touch-startup-image` in the second before
 * the page paints, and nothing at all if none matches the device — which is the
 * blank flash CellarBook used to open with. The mark sits at the same share of
 * the width as `.splash-mark` in styles.css, so the app's own splash continues
 * this picture rather than replacing it. The name is not drawn here: there is
 * no font renderer in this script, and the app's splash carries it a moment
 * later.
 */
const splash = (width, height, theme) => {
  const { bg, glass } = THEMES[theme];
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels.set(bg, index * 4);
  }

  const box = Math.round(width * 0.28);
  const left = Math.round((width - box) / 2);
  // Centred on the glass itself, not on its 512-unit box: the artwork sits at
  // 0.55 of the box's height, and the eye wants it a little above the middle.
  const top = Math.round(height * 0.46 - box * 0.55);
  const scale = 512 / box;
  const SS = 3;

  for (let py = 0; py < box; py += 1) {
    for (let px = 0; px < box; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) * scale;
          const y = (py + (sy + 0.5) / SS) * scale;
          const hit = sample(x, y);
          const colour = hit === WINE ? WINE : hit ? glass : bg;
          r += colour[0];
          g += colour[1];
          b += colour[2];
        }
      }
      const n = SS * SS;
      const index = ((top + py) * width + left + px) * 4;
      pixels[index] = Math.round(r / n);
      pixels[index + 1] = Math.round(g / n);
      pixels[index + 2] = Math.round(b / n);
      pixels[index + 3] = 255;
    }
  }
  return pixels;
};

/**
 * Portrait iPhone sizes in device pixels. iOS matches on the exact logical size
 * and pixel ratio, so a size that is not listed gets no launch image at all —
 * hence covering the range still in use rather than only the newest.
 */
const DEVICES = [
  [1320, 2868],
  [1290, 2796],
  [1284, 2778],
  [1242, 2688],
  [1206, 2622],
  [1179, 2556],
  [1170, 2532],
  [1125, 2436],
  [828, 1792],
  [750, 1334],
];

for (const [width, height] of DEVICES) {
  for (const theme of ['dark', 'light']) {
    const name = `splash-${width}x${height}-${theme}.png`;
    writeFileSync(out(name), png(width, height, splash(width, height, theme)));
    console.log(`wrote public/${name}`);
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#16110f"/>
  <path d="M138 132h236a118 118 0 0 1-118 187 118 118 0 0 1-118-187Z" fill="#f5ece8"/>
  <path d="M143.5 196h225a118 118 0 0 1-112.5 123A118 118 0 0 1 143.5 196Z" fill="#a5203c"/>
  <rect x="243" y="318" width="26" height="84" fill="#f5ece8"/>
  <ellipse cx="256" cy="412" rx="80" ry="19" fill="#f5ece8"/>
</svg>
`;
writeFileSync(out('favicon.svg'), svg);
console.log('wrote public/favicon.svg');
