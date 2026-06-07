// M15.7 — generate PLACEHOLDER PWA icons (no image deps).
//
// Draws a solid brand-blue tile with a simple white upward "bars" glyph, encoded
// as a valid PNG via Node's built-in zlib. These are intentionally crude
// placeholders for a designer to replace — see PWA-NOTES.md.
//
// Run: node scripts/gen-icons.mjs   (also invoked by `pnpm gen:icons`)

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");
mkdirSync(OUT_DIR, { recursive: true });

// Brand accent (matches --accent in tokens.css light theme: #2563eb).
const BG = [37, 99, 235];
const FG = [255, 255, 255];

/** CRC32 for PNG chunks. */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Build an RGBA pixel buffer: solid BG, with three ascending white bars + a
 * trend tick — a generic "investment" glyph. `maskable` keeps the glyph inside
 * the safe zone (centre 80%) so platforms can crop the corners.
 */
function drawPixels(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    px[o] = r;
    px[o + 1] = g;
    px[o + 2] = b;
    px[o + 3] = 255;
  };

  // Fill background.
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) set(x, y, BG);

  // Glyph geometry. Maskable safe zone = central 80%.
  const inset = maskable ? size * 0.18 : size * 0.22;
  const area = size - inset * 2;
  const baseY = inset + area * 0.82;
  const barW = area * 0.16;
  const gap = area * 0.1;
  const heights = [0.32, 0.55, 0.82]; // ascending

  let x = inset + gap;
  for (const h of heights) {
    const barH = area * h;
    const top = baseY - barH;
    for (let yy = Math.floor(top); yy < baseY; yy++)
      for (let xx = Math.floor(x); xx < x + barW; xx++) set(xx, yy, FG);
    x += barW + gap;
  }

  return px;
}

function encodePng(size, maskable) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // 10,11,12 = compression/filter/interlace = 0

  const pixels = drawPixels(size, maskable);
  // Add the per-scanline filter byte (0 = none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(
      raw,
      y * (size * 4 + 1) + 1,
      y * size * 4,
      (y + 1) * size * 4,
    );
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
];

for (const t of targets) {
  writeFileSync(join(OUT_DIR, t.name), encodePng(t.size, t.maskable));
  console.log(`wrote icons/${t.name} (${t.size}x${t.size})`);
}
