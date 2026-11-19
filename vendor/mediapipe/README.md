# MediaPipe Face Detector (vendored for Start from a selfie)

Google's MediaPipe Tasks Vision Face Detector, copied into the repo so the app
can find a face in a photo on the phone with no network.

Version: `@mediapipe/tasks-vision` **1.2.3** (npm dist-tag `latest` on
2026-11-19; not a nightly or rc). Published 2026-11-11. Licence: Apache-2.0.

## Load lazily — do not add these files to the SHELL list in `sw.js`

These files are about 30 MB together. They must not go in the `SHELL` array in
`sw.js` (that list is downloaded on every release install). Load them only the
first time someone taps Start from a selfie.

Anything under `vendor/` is already kept in the `tabs-vendor` cache on first
fetch, and that cache is kept across releases, so once the files have been
loaded they work offline.

## How the pieces go together

```js
import { FaceDetector, FilesetResolver } from "./vendor/mediapipe/vision_bundle.mjs";

const vision = await FilesetResolver.forVisionTasks("vendor/mediapipe/wasm");
const detector = await FaceDetector.createFromModelPath(
  vision,
  "vendor/mediapipe/models/blaze_face_short_range.tflite"
);
```

`FilesetResolver.forVisionTasks(wasmDir)` loads `vision_wasm_internal.js` and
`.wasm` (the SIMD build). Pass `true` as the second argument to load
`vision_wasm_module_internal.js` and `.wasm` instead, which is this release's
fallback when SIMD is not available. This package does not ship
`vision_wasm_nosimd_internal.js` or `.wasm`.

## Files

Sizes and SHA-256 are of the files in this folder, as added.

| File | Bytes | SHA-256 | Source |
|---|---:|---|---|
| `vision_bundle.mjs` | 155990 | `fb0c02c296f44ce0cc324ba16bd646d8773eb4a7847db4019cc4d0430db7a9b5` | `@mediapipe/tasks-vision@1.2.3` tarball, `package/vision_bundle.mjs` |
| `wasm/vision_wasm_internal.js` | 336624 | `2aa5fd3fdd3d8208cd7587df0bb19fb6925c4ea16a76dd025aedc1f64d6a6309` | same tarball, `package/wasm/vision_wasm_internal.js` |
| `wasm/vision_wasm_internal.wasm` | 14665716 | `225bc06c0f51a9cf31fea0e9e0b0243e9e01fb5ef332cc1a7fa6656dbdfdaabf` | same tarball, `package/wasm/vision_wasm_internal.wasm` |
| `wasm/vision_wasm_module_internal.js` | 336662 | `d29996249490361715c769c6a49b43ad47e6ac9a28a8e8bce8d02b238e897851` | same tarball, `package/wasm/vision_wasm_module_internal.js` |
| `wasm/vision_wasm_module_internal.wasm` | 14665738 | `a269e84b12aefc93c9d6a4d62b01f41e5434a9fa941533bb8e75b1e3d1669e46` | same tarball, `package/wasm/vision_wasm_module_internal.wasm` |
| `models/blaze_face_short_range.tflite` | 229746 | `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` | see model URL below |
| `LICENSE` | 12331 | `8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8` | see licence note below |
| `README.md` | (this file) | (this file) | written for this vendor copy |

Tarball: `https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-1.2.3.tgz`
(npm shasum `269f616515f3e244c9812e7738aa71551cbd9822`).

The tarball also contains `vision_bundle.js`, `vision_bundle.cjs`, source maps
and `vision.d.ts`. Those are not needed to run the ES module in the app, so
they were left out.

## Model URL

Fetched 2026-11-19 from the official "latest" path, which returned HTTP 200
with no redirect (229,746 bytes):

`https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite`

The versioned path is the same bytes (SHA-256 matches):

`https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`

The file starts with the TFLite `TFL3` identifier.

## Licence

`package.json` in `@mediapipe/tasks-vision@1.2.3` lists Apache-2.0, but the
npm tarball does not include a `LICENSE` file. `LICENSE` here is the official
MediaPipe licence (Apache-2.0 plus third-party notices from that repository),
fetched 2026-11-19 from:

`https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE`
