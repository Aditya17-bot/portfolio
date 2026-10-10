// Copy the onnxruntime-web WASM runtime into public/ so it is self-hosted.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/ort", { recursive: true });
for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  copyFileSync(`node_modules/onnxruntime-web/dist/${f}`, `public/ort/${f}`);
}
