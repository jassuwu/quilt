import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { C, faviconSvg, maskableSvg, solidSvg } from "./art";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

function toPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  return Buffer.from(resvg.render().asPng());
}

/** Wrap a PNG in a minimal single-image .ico container (PNG-in-ICO). */
function pngToIco(png: Buffer, size: number): Buffer {
  const dim = size >= 256 ? 0 : size;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(dim, 0); // width
  entry.writeUInt8(dim, 1); // height
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image size
  entry.writeUInt32LE(22, 12); // offset (6 + 16)
  return Buffer.concat([header, entry, png]);
}

const manifest = {
  name: "quilt",
  short_name: "quilt",
  description: "Merge every GitHub account's contribution graph into one quilt of green.",
  start_url: "/",
  display: "standalone",
  background_color: C.bg,
  theme_color: C.bg,
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

await mkdir(publicDir, { recursive: true });
const write = (name: string, data: string | Buffer) => writeFile(join(publicDir, name), data);

await write("favicon.svg", faviconSvg());
await write("favicon.ico", pngToIco(toPng(faviconSvg(), 32), 32));
await write("apple-touch-icon.png", toPng(solidSvg(), 180));
await write("icon-192.png", toPng(solidSvg(), 192));
await write("icon-512.png", toPng(solidSvg(), 512));
await write("icon-512-maskable.png", toPng(maskableSvg(), 512));
await write("site.webmanifest", JSON.stringify(manifest, null, 2));

console.log("✓ favicon.svg, favicon.ico, apple-touch-icon, icon-192/512(+maskable), site.webmanifest");
