// Photo tracer: turns a reference photo (or a line drawing) into clean vector lines taken from the
// photo's own pixels, so the shape is exact. Claude only points at the subject (a box, areas to leave out);
// the outline comes from separating the subject from its background, the details from real edges.
// Output coordinates are drawing units: 600 across the image width.
const PhotoTrace = (() => {
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pct = (arr, p) => { if (!arr.length) return 0; const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

  // Square dilate / erode on a 0/1 mask (separable, radius r).
  function morph(m, W, H, r, grow) {
    const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let k = -r; k <= r; k++) { const xx = x + k; const b = xx < 0 || xx >= W ? 0 : m[y * W + xx]; if (grow ? b : !b) { v = grow ? 1 : 0; break; } }
      t[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let k = -r; k <= r; k++) { const yy = y + k; const b = yy < 0 || yy >= H ? 0 : t[yy * W + x]; if (grow ? b : !b) { v = grow ? 1 : 0; break; } }
      o[y * W + x] = v;
    }
    return o;
  }

  // Simple k-means on RGB samples.
  function kmeans(samples, k) {
    const n = samples.length / 3; if (!n) return [];
    k = Math.min(k, n);
    const c = [];
    for (let j = 0; j < k; j++) { const i = Math.floor((j + 0.5) * n / k); c.push([samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]]); }
    for (let it = 0; it < 10; it++) {
      const sum = c.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < k; j++) { const d = (samples[i * 3] - c[j][0]) ** 2 + (samples[i * 3 + 1] - c[j][1]) ** 2 + (samples[i * 3 + 2] - c[j][2]) ** 2; if (d < bd) { bd = d; best = j; } }
        const s = sum[best]; s[0] += samples[i * 3]; s[1] += samples[i * 3 + 1]; s[2] += samples[i * 3 + 2]; s[3]++;
      }
      sum.forEach((s, j) => { if (s[3]) c[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    }
    return c;
  }

  // Zhang-Suen thinning (for line drawings: one centre line per inked stroke).
  function thin(m, W, H) {
    let changed = true;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x]);
    for (let guard = 0; changed && guard < 40; guard++) {
      changed = false;
      for (const step of [0, 1]) {
        const del = [];
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          if (!m[y * W + x]) continue;
          const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
          const b = p.reduce((s, v) => s + v, 0); if (b < 2 || b > 6) continue;
          let a = 0; for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) a++;
          if (a !== 1) continue;
          if (step === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
          del.push(y * W + x);
        }
        for (const i of del) m[i] = 0;
        if (del.length) changed = true;
      }
    }
    return m;
  }

  const NB = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  // Link the set pixels of a 0/1 map into point chains.
  function chainsOf(edge, W, H, minLen) {
    const seen = new Uint8Array(edge.length), out = [];
    const walk = (start) => {
      const pts = [start]; seen[start] = 1; let cur = start;
      for (;;) {
        const x = cur % W, y = (cur - x) / W; let next = -1;
        for (const [dx, dy] of NB) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (edge[j] && !seen[j]) { next = j; break; } }
        if (next < 0) break; seen[next] = 1; pts.push(next); cur = next;
      }
      return pts;
    };
    for (let i = 0; i < edge.length; i++) {
      if (!edge[i] || seen[i]) continue;
      const fwd = walk(i), back = walk(i).slice(1);
      const pts = back.reverse().concat(fwd);
      if (pts.length >= minLen) out.push(pts.map((p) => [p % W, (p - p % W) / W]));
    }
    return out;
  }
  function smooth(pts, closed, r = 2) {
    if (pts.length < 2 * r + 3) return pts;
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      if (!closed && (i < r || i >= n - r)) { out.push(pts[i]); continue; }
      let sx = 0, sy = 0;
      for (let k = -r; k <= r; k++) { const p = pts[(i + k + n) % n]; sx += p[0]; sy += p[1]; }
      out.push([sx / (2 * r + 1), sy / (2 * r + 1)]);
    }
    return out;
  }
  function rdp(pts, eps) {
    if (pts.length < 3) return pts;
    const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1]; const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    let md = 0, mi = 0;
    for (let k = 1; k < pts.length - 1; k++) {
      const d = L > 1 ? Math.abs((y2 - y1) * pts[k][0] - (x2 - x1) * pts[k][1] + x2 * y1 - y2 * x1) / L : Math.hypot(pts[k][0] - x1, pts[k][1] - y1);
      if (d > md) { md = d; mi = k; }
    }
    return md > eps ? rdp(pts.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(pts.slice(mi), eps)) : [pts[0], pts[pts.length - 1]];
  }
  const pack = (arr, max = 10000) => { const out = []; let cur = ''; for (const d of arr) { if (cur && cur.length + d.length > max) { out.push(cur); cur = ''; } cur += d; } if (cur) out.push(cur); return out; };

  // loc: { box: [x, y, w, h], erase: [[x, y, w, h]], rotors: [{hub, r}], kind: 'photo' | 'drawing' } in drawing units.
  // level: 'clean' (outline + the strongest details) or 'detailed' (many more real edges).
  async function trace(src, loc, level = 'clean') {
    const img = typeof src === 'string' ? await loadImg(src) : src;
    const W = 1200, f = W / 600, H = clamp(Math.round(W * img.naturalHeight / img.naturalWidth), 60, 1600), N = W * H;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const drawing = loc.kind === 'drawing';

    // Grey for details; colour edges (strongest of R, G, B) so tan-on-grey edges count as much as light-on-dark.
    const gray = new Float32Array(N);
    for (let i = 0; i < N; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    const K = [1, 4, 6, 4, 1];
    const blur = (src) => {
      let a = src, b = new Float32Array(N);
      for (let pass = 0; pass < 2; pass++) {
        const o = pass ? new Float32Array(N) : b;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let s = 0;
          for (let k = -2; k <= 2; k++) { const xx = pass ? x : clamp(x + k, 0, W - 1), yy = pass ? clamp(y + k, 0, H - 1) : y; s += a[yy * W + xx] * K[k + 2]; }
          o[y * W + x] = s / 16;
        }
        a = o;
      }
      return a;
    };
    const mag = new Float32Array(N), dir = new Uint8Array(N);
    for (const ch of [0, 1, 2]) {
      const c = new Float32Array(N); for (let i = 0; i < N; i++) c[i] = px[i * 4 + ch];
      const a = blur(c);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const gx = -a[i - W - 1] - 2 * a[i - 1] - a[i + W - 1] + a[i - W + 1] + 2 * a[i + 1] + a[i + W + 1];
        const gy = -a[i - W - 1] - 2 * a[i - W] - a[i - W + 1] + a[i + W - 1] + 2 * a[i + W] + a[i + W + 1];
        const m = Math.hypot(gx, gy);
        if (m > mag[i]) {
          mag[i] = m;
          let ang = Math.atan2(gy, gx) * 180 / Math.PI; if (ang < 0) ang += 180;
          dir[i] = ang < 22.5 || ang >= 157.5 ? 0 : ang < 67.5 ? 1 : ang < 112.5 ? 2 : 3;
        }
      }
    }

    // The area Claude pointed at, padded a little.
    const box = (loc.box || [0, 0, 600, H / f]).map((v) => v * f);
    const pad = Math.round(0.02 * W + 0.04 * box[2]);
    const x0 = clamp(Math.round(box[0] - pad), 0, W - 1), y0 = clamp(Math.round(box[1] - pad), 0, H - 1);
    const x1 = clamp(Math.round(box[0] + box[2] + pad), x0 + 1, W), y1 = clamp(Math.round(box[1] + box[3] + pad), y0 + 1, H);
    const inBox = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

    // Watershed: background grows in from the margin between Claude's box and the padding, the subject grows out
    // from the points Claude marked on it, both in order of edge strength, so they meet on the real edges.
    const lab0 = new Uint8Array(N), LV = 1024, buckets = Array.from({ length: LV }, () => []);
    const lev = (i) => Math.min(LV - 1, Math.round(mag[i]));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inBox(x, y)) lab0[y * W + x] = 1;
    const bx0 = Math.round(box[0]), by0 = Math.round(box[1]), bx1 = Math.round(box[0] + box[2]), by1 = Math.round(box[1] + box[3]);
    const inner0 = (x, y) => x >= bx0 && x < bx1 && y >= by0 && y < by1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!inner0(x, y)) { const i = y * W + x; lab0[i] = 1; buckets[lev(i)].push(i); }
    const pts = (Array.isArray(loc.inside) && loc.inside.length ? loc.inside : [[box[0] / f + box[2] / f / 2, box[1] / f + box[3] / f / 2]]).slice(0, 30);
    for (const [ux, uy] of pts) {
      const cx = Math.round(ux * f), cy = Math.round(uy * f);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy; if (dx * dx + dy * dy > 16 || !inBox(x, y)) continue;
        const i = y * W + x; if (!lab0[i]) { lab0[i] = 2; buckets[lev(i)].push(i); }
      }
    }
    for (let L = 0; L < LV; L++) {
      const bk = buckets[L];
      while (bk.length) {
        const i = bk.pop(), x = i % W, y = (i - x) / W, me = lab0[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy; if (!inBox(xx, yy)) continue;
          const j = yy * W + xx; if (lab0[j]) continue;
          lab0[j] = me; const l = Math.max(L, lev(j)); buckets[l].push(j);
        }
      }
    }
    const bg = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) bg[i] = lab0[i] === 2 ? 0 : 1;
    let fg = new Uint8Array(N);
    for (let i = 0; i < N; i++) fg[i] = bg[i] ? 0 : 1;
    for (const [ex, ey, ew, eh] of loc.erase || []) {
      for (let y = clamp(Math.round(ey * f), 0, H); y < clamp(Math.round((ey + eh) * f), 0, H); y++) for (let x = clamp(Math.round(ex * f), 0, W); x < clamp(Math.round((ex + ew) * f), 0, W); x++) fg[y * W + x] = 0;
    }
    fg = morph(morph(fg, W, H, 2, true), W, H, 2, false);   // close small gaps
    fg = morph(morph(fg, W, H, 1, false), W, H, 1, true);   // drop specks
    // Thin rotor blades are drawn (and animated) by the app, so take them out of the photo outline.
    for (const r of loc.rotors || []) {
      if (!r || !Array.isArray(r.hub)) continue;
      const hx = r.hub[0] * f, hy = r.hub[1] * f, rr = (r.r || 0) * f * 1.1, Lv = Math.max(7, Math.round(0.03 * box[3]));
      const ry0 = clamp(Math.round(hy - 0.12 * box[3]), 0, H), ry1 = clamp(Math.round(hy + 0.16 * box[3]), 0, H);
      const rx0 = clamp(Math.round(hx - rr), 0, W), rx1 = clamp(Math.round(hx + rr), 0, W);
      for (let x = rx0; x < rx1; x++) {
        let y = ry0;
        while (y < ry1) {
          if (!fg[y * W + x]) { y++; continue; }
          let e = y; while (e < H && fg[e * W + x]) e++;
          if (e - y < Lv && e <= ry1 + Lv) for (let k = y; k < e; k++) fg[k * W + x] = 0;
          y = e;
        }
      }
    }
    // Keep the main pieces only.
    const lab = new Int32Array(N), areas = [0];
    for (let i = 0; i < N; i++) {
      if (!fg[i] || lab[i]) continue;
      const id = areas.length; let n = 0; qh = 0; qt = 0; q[qt++] = i; lab[i] = id;
      while (qh < qt) {
        const p = q[qh++], x = p % W, y = (p - x) / W; n++;
        for (const [dx, dy] of NB) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (fg[j] && !lab[j]) { lab[j] = id; q[qt++] = j; } }
      }
      areas.push(n);
    }
    const big = Math.max(...areas), keep = areas.map((n) => n >= big * 0.04);
    let area = 0;
    for (let i = 0; i < N; i++) { fg[i] = fg[i] && keep[lab[i]] ? 1 : 0; area += fg[i]; }
    const frac = area / ((x1 - x0) * (y1 - y0));
    if (frac < 0.04 || frac > 0.96) return { ok: false, frac, dbg: {} };

    // Outline: the subject's boundary, smoothed lightly.
    const edgeOut = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!fg[i]) continue;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || !fg[i - 1] || !fg[i + 1] || !fg[i - W] || !fg[i + W]) edgeOut[i] = 1;
    }
    const r1 = (v) => String(Math.round(v / f * 10) / 10);
    const toD = (pts, closed) => 'M' + pts.map(([x, y]) => r1(x) + ' ' + r1(y)).join('L') + (closed ? 'Z' : '');
    const outline = [];
    for (const ch of chainsOf(edgeOut, W, H, 10).sort((p, q2) => q2.length - p.length)) {
      const closed = Math.hypot(ch[0][0] - ch[ch.length - 1][0], ch[0][1] - ch[ch.length - 1][1]) <= 2.5;
      outline.push(toD(rdp(smooth(ch, closed, 2), 0.9), closed));
    }

    // Details inside the subject.
    const inner = morph(fg, W, H, drawing ? 2 : 3, false);
    let detail;
    if (drawing) {
      const vals = []; for (let i = 0; i < N; i++) if (inner[i]) vals.push(gray[i]);
      const thr = Math.min(pct(vals, 0.5) - 40, 170);
      const ink = new Uint8Array(N); for (let i = 0; i < N; i++) ink[i] = inner[i] && gray[i] < thr ? 1 : 0;
      detail = chainsOf(thin(ink, W, H), W, H, level === 'detailed' ? 8 : 16).map((pts) => ({ pts, str: pts.length }));
    } else {
      const nms = new Float32Array(N), vals = [];
      const OFF = [[1, 0], [1, 1], [0, 1], [-1, 1]];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!inner[i] || mag[i] < 4) continue;
        const [dx, dy] = OFF[dir[i]];
        if (mag[i] >= mag[i + dy * W + dx] && mag[i] >= mag[i - dy * W - dx]) { nms[i] = mag[i]; vals.push(mag[i]); }
      }
      const hi = pct(vals, level === 'detailed' ? 0.62 : 0.8), lo = hi * (level === 'detailed' ? 0.35 : 0.45);
      const edge = new Uint8Array(N), st = [];
      for (let i = 0; i < N; i++) if (nms[i] >= hi) { edge[i] = 1; st.push(i); }
      while (st.length) {
        const i = st.pop(), x = i % W, y = (i - x) / W;
        for (const [dx, dy] of NB) { const j = (y + dy) * W + (x + dx); if (j > 0 && j < N && !edge[j] && nms[j] >= lo) { edge[j] = 1; st.push(j); } }
      }
      detail = chainsOf(edge, W, H, level === 'detailed' ? 14 : 22).filter((pts) => {
        // Skip squiggles (texture, noise): keep long or fairly straight runs.
        const s = pts[0], e = pts[pts.length - 1], span = Math.hypot(e[0] - s[0], e[1] - s[1]);
        return !(pts.length < 40 && pts.length > 2.6 * Math.max(span, 1));
      }).map((pts) => { let s = 0; for (const [x, y] of pts) s += mag[y * W + x]; return { pts, str: (s / pts.length) * Math.sqrt(pts.length) }; });
    }
    detail.sort((p, q2) => q2.str - p.str);
    if (level !== 'detailed') detail = detail.slice(0, 90);
    let budget = level === 'detailed' ? 200000 : 60000;
    const segs = [];
    for (const d of detail) { const s = toD(rdp(smooth(d.pts, false, 1), level === 'detailed' ? 1.2 : 1.4), false); if ((budget -= s.length) < 0) break; segs.push(s); }
    const cut = Math.max(1, Math.round(segs.length * (level === 'detailed' ? 0.35 : 0.5)));
    return { ok: true, frac, dbg: {}, H: Math.round(H / f), outline: pack(outline), strong: pack(segs.slice(0, cut)), weak: pack(segs.slice(cut)) };
  }

  return { trace };
})();
