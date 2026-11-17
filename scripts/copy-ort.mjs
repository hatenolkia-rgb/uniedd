// Copies the onnxruntime-web runtime files (and the Signalsmith Stretch pitch
// shifter) used by the Karaoke Maker into
// public/karaoke/ort so they are served same-origin (needed for the
// multi-threaded WASM backend). Runs automatically before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dest = join(root, "public", "karaoke", "ort");
const files = [
  "ort.wasm.min.mjs",
  "ort.webgpu.min.mjs",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];
if (!existsSync(src)) {
  console.error("copy-ort: onnxruntime-web is not installed");
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
for (const f of files) copyFileSync(join(src, f), join(dest, f));
// The pitch shifter builds its AudioWorklet from its own function source, so it
// must not go through the bundler/minifier: serve the original file as-is.
const stretch = join(root, "node_modules", "signalsmith-stretch", "SignalsmithStretch.mjs");
copyFileSync(stretch, join(dest, "SignalsmithStretch.mjs"));
console.log(`copy-ort: copied ${files.length + 1} files to public/karaoke/ort`);
