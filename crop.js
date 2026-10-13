// Framing a photo for a set cover: drag to move, pinch or scroll to zoom.
// Loaded the first time a photo is chosen.
import { $ } from "./app.js";

// Frame a photo for a cover: drag to move, pinch (or scroll) to zoom, then Use photo.
// Saved as a 600 px square JPEG, with its average color for the page tint.
export function cropPhoto(file, done) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const ov = document.createElement("div");
    ov.className = "crop";
    ov.innerHTML = `<div class="cr-top">Frame your cover</div><div class="cr-area" id="cr-area"><img src="${url}" alt="" draggable="false"><div class="cr-frame"></div></div>
      <div class="cr-hint">Drag and pinch to frame it</div><div class="cr-bar"><button class="tb" id="cr-x">Cancel</button><button class="tb go" id="cr-ok">Use photo</button></div>`;
    document.body.appendChild(ov);
    const area = $("cr-area"), el = area.querySelector("img"), frame = area.querySelector(".cr-frame");
    const F = () => frame.getBoundingClientRect(), A = () => area.getBoundingClientRect();
    const fr = F(), min = Math.max(fr.width / img.naturalWidth, fr.height / img.naturalHeight);
    let sc = min, x = 0, y = 0;
    const clamp = () => {
      const f = F(), a = A(), w = img.naturalWidth * sc, h = img.naturalHeight * sc;
      const fx = f.left - a.left, fy = f.top - a.top;
      x = Math.min(fx, Math.max(fx + f.width - w, x)); y = Math.min(fy, Math.max(fy + f.height - h, y));
      el.style.width = w + "px"; el.style.transform = `translate(${x}px, ${y}px)`;
    };
    { const f = F(), a = A(); x = f.left - a.left - (img.naturalWidth * sc - f.width) / 2; y = f.top - a.top - (img.naturalHeight * sc - f.height) / 2; }
    clamp();
    const pts = new Map(); let last = null;
    const zoomAt = (k, cx, cy) => { const a = A(), nx = sc * k < min ? min / sc : Math.min(k, 6 * min / sc); x = cx - a.left - (cx - a.left - x) * nx; y = cy - a.top - (cy - a.top - y) * nx; sc *= nx; clamp(); };
    area.onpointerdown = e => { area.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); last = null; };
    area.onpointermove = e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, e);
      if (pts.size === 1) { x += e.clientX - prev.clientX; y += e.clientY - prev.clientY; clamp(); return; }
      const [p1, p2] = [...pts.values()], d = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      if (last) zoomAt(d / last, (p1.clientX + p2.clientX) / 2, (p1.clientY + p2.clientY) / 2);
      last = d;
    };
    area.onpointerup = area.onpointercancel = e => { pts.delete(e.pointerId); last = null; };
    area.onwheel = e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.08 : 1 / 1.08, e.clientX, e.clientY); };
    const end = () => { ov.remove(); URL.revokeObjectURL(url); };
    $("cr-x").onclick = end;
    $("cr-ok").onclick = () => {
      const f = F(), a = A(), c = document.createElement("canvas");
      c.width = c.height = 600;
      const g = c.getContext("2d");
      const sx = (f.left - a.left - x) / sc, sy = (f.top - a.top - y) / sc, sw = f.width / sc;
      g.drawImage(img, sx, sy, sw, sw, 0, 0, 600, 600);
      const t = document.createElement("canvas"); t.width = t.height = 1;
      t.getContext("2d").drawImage(c, 0, 0, 1, 1);
      const [r, gg, b] = t.getContext("2d").getImageData(0, 0, 1, 1).data;
      /* The photo's hue, lifted so even a dark photo tints the page. */
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn || 1;
      const h = mx === mn ? 20 : Math.round(60 * (mx === r ? ((gg - b) / d + 6) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4));
      done(c.toDataURL("image/jpeg", 0.82), `${h} 45% 42%`);
      end();
    };
  };
  img.src = url;
}
