/* global createImageBitmap */
// Start from a selfie (Gig poster, 2026-11-19). The photo only picks the maker's starting parts (skin tone, hair
// colour, beard). It never becomes the art, is never saved (no storage, no cache, no upload) and is dropped as soon
// as the guesses are made. The face finder (MediaPipe Face Detector, vendor/mediapipe) loads the first time someone
// taps the button; the service worker keeps vendor files after that, so it works offline.
import { selfieGuess } from "./core.js";
import { HAIR_COL, SKIN } from "./guitarist.js";

const DIR = new URL("./vendor/mediapipe/", import.meta.url).href;
let finder = null;

/* the face finder, made once: the fast WebAssembly build first, then the release's fallback build */
/* MediaPipe's library tries to send usage logs to Google (odml.pa.googleapis.com). The CSP blocks it anyway; this answers those
   calls on the phone so nothing is even attempted (4.99.0, Grok's review). */
let quiet = false;
function quietLogs() {
  if (quiet) return; quiet = true;
  const block = u => /odml\.pa\.googleapis\.com|play\.googleapis\.com\/log/.test(String(u?.url || u));
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => block(u) ? Promise.resolve(new Response(null, { status: 204 })) : f(u, o);
  if (navigator.sendBeacon) { const b = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, d) => block(u) ? true : b(u, d); }
}
export async function faceFinder() {
  if (finder) return finder;
  quietLogs();
  const { FaceDetector, FilesetResolver } = await import(DIR + "vision_bundle.mjs");
  const make = async fallback => FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks(DIR + "wasm", fallback), {
    baseOptions: { modelAssetPath: DIR + "models/blaze_face_short_range.tflite", delegate: "CPU" }, runningMode: "IMAGE", minDetectionConfidence: 0.5
  });
  try { finder = await make(false); } catch { finder = await make(true); }
  return finder;
}

/* ask for a photo: the camera (front) or the photo picker, whichever the phone offers */
export function pickPhoto() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.setAttribute("capture", "user");
    input.style.cssText = "position:fixed;left:-9999px;opacity:0";
    let settled = false;
    const done = f => { if (settled) return; settled = true; input.value = ""; input.remove(); resolve(f || null); };
    input.addEventListener("change", () => done(input.files?.[0]));
    input.addEventListener("cancel", () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

/* the median colour of a small square, clipped to the picture */
function sample(ctx, w, h, x, y, r) {
  const x0 = Math.max(0, Math.round(x - r)), y0 = Math.max(0, Math.round(y - r)), x1 = Math.min(w, Math.round(x + r)), y1 = Math.min(h, Math.round(y + r));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data, ch = [[], [], []];
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) ch[c].push(px[i + c]);
  return ch.map(v => { v.sort((a, b) => a - b); return v[v.length >> 1]; });
}

/* where to look, from the face box and its six key points (eyes, nose, mouth, ears), in picture pixels */
export function samplesOf(ctx, w, h, det) {
  const b = det.boundingBox, k = (det.keypoints || []).map(p => ({ x: p.x * w, y: p.y * h }));
  const [eR, eL, , mouth] = k, r = Math.max(3, b.width * 0.05);
  const eyeY = eR && eL ? (eR.y + eL.y) / 2 : b.originY + b.height * 0.4;
  const mY = mouth ? mouth.y : b.originY + b.height * 0.75, cx = mouth ? mouth.x : b.originX + b.width / 2;
  const cheekL = eR ? sample(ctx, w, h, eR.x, (eyeY + mY) / 2, r) : null, cheekR = eL ? sample(ctx, w, h, eL.x, (eyeY + mY) / 2, r) : null;
  const forehead = sample(ctx, w, h, cx, eyeY - b.height * 0.22, r);
  const hair = [
    sample(ctx, w, h, cx, b.originY - b.height * 0.06, r),
    sample(ctx, w, h, b.originX - b.width * 0.04, b.originY + b.height * 0.18, r),
    sample(ctx, w, h, b.originX + b.width * 1.04, b.originY + b.height * 0.18, r)
  ].filter(Boolean);
  const cheek = cheekL && cheekR ? cheekL.map((v, i) => (v + cheekR[i]) / 2) : cheekL || cheekR;
  const chin = sample(ctx, w, h, cx, Math.min(b.originY + b.height * 0.98, mY + b.height * 0.17), r);
  return { skin: [cheekL, cheekR, forehead].filter(Boolean), hair, chin, cheek };
}

/* the whole flow: returns { skin, hairCol, beard } from the photo, or null if no photo, no face or no finder */
export async function selfieStart({ onBusy } = {}) {
  const file = await pickPhoto();
  if (!file) return { cancelled: true };
  onBusy?.(true);
  let bmp = null, canvas = null;
  try {
    const det = await faceFinder();
    bmp = await createImageBitmap(file);
    const s = Math.min(1, 640 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
    canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    const found = det.detect(canvas)?.detections || [];
    if (!found.length) return null;
    const face = found.reduce((a, d) => d.boundingBox.width * d.boundingBox.height > a.boundingBox.width * a.boundingBox.height ? d : a);
    return selfieGuess(samplesOf(ctx, w, h, face), { skin: SKIN, hair: HAIR_COL });
  } catch { return null; }
  finally {
    /* drop the photo: nothing of it is kept */
    try { bmp?.close(); } catch { /* already closed */ }
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    bmp = null; canvas = null;
    onBusy?.(false);
  }
}
