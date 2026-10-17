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

  // Simple k-means on RGB samples (flat array r,g,b,...).
  function kmeans(samples, k) {
    const n = samples.length / 3; if (!n) return [];
    k = Math.min(k, n);
    const c = [];
    for (let j = 0; j < k; j++) { const i = Math.floor((j + 0.5) * n / k); c.push([samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]]); }
    for (let it = 0; it < 8; it++) {
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
  // Marching squares: the mask's boundary as clean closed loops (half-pixel precision, no gaps).
  function contours(m, W, H) {
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x]);
    const segs = [];
    for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
      const c = (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
      if (c === 0 || c === 15) continue;
      const T = [2 * x + 1, 2 * y], R = [2 * x + 2, 2 * y + 1], B = [2 * x + 1, 2 * y + 2], L = [2 * x, 2 * y + 1];
      switch (c) {
        case 1: case 14: segs.push([L, B]); break;
        case 2: case 13: segs.push([B, R]); break;
        case 3: case 12: segs.push([L, R]); break;
        case 4: case 11: segs.push([T, R]); break;
        case 6: case 9: segs.push([T, B]); break;
        case 7: case 8: segs.push([L, T]); break;
        case 5: segs.push([L, T], [B, R]); break;
        case 10: segs.push([T, R], [L, B]); break;
      }
    }
    const key = (p) => p[0] * 100003 + p[1], ends = new Map();
    segs.forEach((sg, i) => { for (const p of sg) { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1; const loop = [segs[i][0], segs[i][1]]; let cur = segs[i][1];
      for (;;) {
        const nx = (ends.get(key(cur)) || []).find((j) => !used[j]);
        if (nx === undefined) break;
        used[nx] = 1; const sg = segs[nx]; cur = key(sg[0]) === key(cur) ? sg[1] : sg[0]; loop.push(cur);
      }
      loops.push(loop.map(([a, b]) => [a / 2, b / 2]));
    }
    return loops;
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
  async function traceRaw(src, loc, level = 'clean', opts = {}) {
    const img = typeof src === 'string' ? await loadImg(src) : src;
    const W = clamp(Math.round(img.naturalWidth || 1200), 1200, 1800), f = W / 600, H = clamp(Math.round(W * img.naturalHeight / img.naturalWidth), 60, 1600), N = W * H;
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

    const lab0 = new Uint8Array(N);
    const bx0 = Math.round(box[0]), by0 = Math.round(box[1]), bx1 = Math.round(box[0] + box[2]), by1 = Math.round(box[1] + box[3]);
    const inner0 = (x, y) => x >= bx0 && x < bx1 && y >= by0 && y < by1;
    const disk = (ux, uy, r, fn) => { const cx = Math.round(ux * f), cy = Math.round(uy * f); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (dx * dx + dy * dy <= r * r && inBox(x, y)) fn(y * W + x); } };
    const outs = (Array.isArray(loc.outside) ? loc.outside : []).slice(0, 30);
    // Watershed: background grows in from the margin between Claude's box and the padding, the subject grows out
    // from the points Claude marked on it, in order of edge strength, so they meet on the real edges. Colour helps
    // too: each side pays extra to take pixels that look like the other side (faint edges, pale-on-pale).
    const LV = 1024, buckets = Array.from({ length: LV }, () => []);
    const pts = (Array.isArray(loc.inside) && loc.inside.length ? loc.inside : loc.ai ? [] : [[box[0] / f + box[2] / f / 2, box[1] / f + box[3] / f / 2]]).slice(0, 40);
    // AI cutout (optional, photos only): a 320x320 map of how likely each spot is the subject.
    // Confident subject = subject seeds; confident background well away from the subject = background seeds;
    // the band in between is settled by the photo's real edges.
    let aiCore = null, aiBg = null;
    if (loc.ai && !drawing && loc.ai.length === 320 * 320) {
      const A = new Float32Array(N), ai = loc.ai;
      for (let y = 0; y < H; y++) { const fy = clamp((y + 0.5) * 320 / H - 0.5, 0, 319), y0a = Math.floor(fy), y1a = Math.min(319, y0a + 1), ay = fy - y0a;
        for (let x = 0; x < W; x++) { const fx = clamp((x + 0.5) * 320 / W - 0.5, 0, 319), x0a = Math.floor(fx), x1a = Math.min(319, x0a + 1), ax = fx - x0a;
          A[y * W + x] = (ai[y0a * 320 + x0a] * (1 - ax) + ai[y0a * 320 + x1a] * ax) * (1 - ay) + (ai[y1a * 320 + x0a] * (1 - ax) + ai[y1a * 320 + x1a] * ax) * ay; } }
      let hi = new Uint8Array(N), any = 0;
      for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) { const i = y * W + x; if (A[i] > 0.85) { hi[i] = 1; any++; } }
      if (any > 0.05 * (bx1 - bx0) * (by1 - by0)) {
        aiCore = morph(hi, W, H, 3, false);
        const sub = new Uint8Array(N); for (let i = 0; i < N; i++) sub[i] = A[i] > 0.5 ? 1 : 0;
        const nearSub = morph(sub, W, H, Math.max(6, Math.round(0.012 * W)), true);
        aiBg = new Uint8Array(N); for (let i = 0; i < N; i++) aiBg[i] = !nearSub[i] && A[i] < 0.05 ? 1 : 0;
        // Claude's points win over the AI: no AI subject seeds around anything Claude marked as background (people,
        // vehicles next to it), and no AI background seeds around anything Claude marked as the subject.
        { const R2 = Math.round(0.045 * W);
          for (const [ux, uy] of (Array.isArray(loc.outside) ? loc.outside : [])) {
            const cx = Math.round(ux * f), cy = Math.round(uy * f);
            for (let y = Math.max(0, cy - R2); y < Math.min(H, cy + R2); y++) for (let x = Math.max(0, cx - R2); x < Math.min(W, cx + R2); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R2 * R2) aiCore[y * W + x] = 0;
          } }
        const R = Math.round(0.06 * W);
        for (const [ux, uy] of (Array.isArray(loc.inside) ? loc.inside : [])) {
          const cx = Math.round(ux * f), cy = Math.round(uy * f);
          for (let y = Math.max(0, cy - R); y < Math.min(H, cy + R); y++) for (let x = Math.max(0, cx - R); x < Math.min(W, cx + R); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) aiBg[y * W + x] = 0;
        }
      }
    }
    // Colour models.
    const fs = [], bs = [];
    if (aiCore) { for (let i = 0; i < N; i += 37) { if (aiCore[i]) fs.push(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); else if (aiBg[i] && inBox(i % W, (i - i % W) / W)) bs.push(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); } }
    for (const [ux, uy] of pts) disk(ux, uy, 6, (i) => fs.push(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]));
    const st2 = Math.max(1, Math.round(Math.sqrt((x1 - x0) * (y1 - y0) / 20000)));
    for (let y = y0; y < y1; y += st2) for (let x = x0; x < x1; x += st2) if (!inner0(x, y)) { const i = (y * W + x) * 4; bs.push(px[i], px[i + 1], px[i + 2]); }
    for (const [ux, uy] of outs) disk(ux, uy, 4, (i) => bs.push(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]));
    const CF = kmeans(fs, 8), CB = kmeans(bs, 8);
    const near = (C, i) => { let bd = Infinity; for (const c of C) { const d = (px[i * 4] - c[0]) ** 2 + (px[i * 4 + 1] - c[1]) ** 2 + (px[i * 4 + 2] - c[2]) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); };
    const lean = new Float32Array(N);   // > 0 looks like the subject, < 0 like the background
    if (CF.length && CB.length) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; lean[i] = near(CB, i) - near(CF, i); }
    // What counts as a wall: in photos, edges (lettering and markings Claude boxed don't count);
    // in line drawings, the ink, thickened so hairline gaps between lines still hold.
    let sm;
    if (drawing) {
      const gv = []; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) gv.push(gray[y * W + x]);
      const thr = (pct(gv, 0.02) + pct(gv, 0.6)) / 2;
      const ink = new Uint8Array(N); for (let i = 0; i < N; i++) ink[i] = gray[i] < thr ? 1 : 0;
      const near1 = morph(ink, W, H, 2, true), near2 = morph(ink, W, H, 4, true);
      sm = new Float32Array(N); for (let i = 0; i < N; i++) sm[i] = ink[i] ? 400 : near1[i] ? 300 : near2[i] ? 200 : 0;
      lean.fill(0);
    } else {
      sm = mag.slice();
      for (const [ex, ey, ew, eh] of (loc.erase || []).slice(0, 30)) {
        for (let y = clamp(Math.round((ey + 2) * f), 0, H); y < clamp(Math.round((ey + eh - 2) * f), 0, H); y++) for (let x = clamp(Math.round((ex + 2) * f), 0, W); x < clamp(Math.round((ex + ew - 2) * f), 0, W); x++) sm[y * W + x] *= 0.15;
      }
    }
    const cost = (j, me) => Math.min(LV - 1, Math.round(sm[j] + Math.min(40, 0.4 * Math.max(0, me === 1 ? lean[j] : -lean[j]))));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inBox(x, y)) lab0[y * W + x] = 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!inner0(x, y)) { const i = y * W + x; lab0[i] = 1; buckets[0].push(i * 2); }
    for (const [ux, uy] of outs) disk(ux, uy, 4, (i) => { if (!lab0[i]) { lab0[i] = 1; buckets[0].push(i * 2); } });
    for (const [ux, uy] of pts) disk(ux, uy, 6, (i) => { if (!lab0[i]) { lab0[i] = 2; buckets[0].push(i * 2 + 1); } });
    if (aiCore) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x; if (lab0[i]) continue;
      if (aiCore[i] && inner0(x, y)) { lab0[i] = 2; buckets[0].push(i * 2 + 1); }
      else if (aiBg[i]) { lab0[i] = 1; buckets[0].push(i * 2); }
    }
    // Split the queue by side so ties go to the subject (enclosed regions both sides reach at once).
    const fgB = Array.from({ length: LV }, () => []);
    for (let L = 0; L < LV; L++) { const keep = []; for (const e of buckets[L]) (e & 1 ? fgB[L] : keep).push(e); buckets[L] = keep; }
    const done = new Uint8Array(N);
    const step = (e, L) => {
      const i = e >> 1, me = (e & 1) + 1;
      if (done[i] || (lab0[i] && lab0[i] !== me)) return;
      done[i] = 1; lab0[i] = me;
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (!inBox(xx, yy)) continue;
        const j = yy * W + xx; if (lab0[j]) continue;
        const l = Math.max(L, cost(j, me)); (me === 2 ? fgB : buckets)[l].push(j * 2 + me - 1);
      }
    };
    for (let L = 0; L < LV; L++) {
      const fb = fgB[L], bb = buckets[L];
      while (fb.length || bb.length) { if (fb.length) step(fb.pop(), L); else step(bb.pop(), L); }
    }
    const bg = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) bg[i] = lab0[i] === 2 ? 0 : 1;
    let fg = new Uint8Array(N);
    for (let i = 0; i < N; i++) fg[i] = bg[i] ? 0 : 1;
    fg = morph(morph(fg, W, H, 2, true), W, H, 2, false);   // close small gaps
    fg = morph(morph(fg, W, H, 2, false), W, H, 2, true);   // drop specks and spikes
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
    if (opts.maskD) {   // detail pass: the subject's shape is already known; just fill it in at this zoom
      const m = document.createElement('canvas'); m.width = W; m.height = H; const mg = m.getContext('2d', { willReadFrequently: true });
      mg.scale(f, f); mg.fillStyle = '#fff'; for (const d of opts.maskD) { try { mg.fill(new Path2D(d)); } catch (e) {} }
      const md = mg.getImageData(0, 0, W, H).data; area = 0; for (let i = 0; i < N; i++) { fg[i] = md[i * 4 + 3] > 127 ? 1 : 0; area += fg[i]; }
      if (area < 50) return { ok: false, frac: 0, dbg: {} };
    }
    const frac = opts.maskD ? 0.5 : area / ((x1 - x0) * (y1 - y0));
    if (frac < 0.04 || frac > 0.96) return { ok: false, frac, dbg: {} };

    // Fill small holes (painted lettering, rivets) so they don't become outline loops.
    {
      const out = new Uint8Array(N); qh = 0; qt = 0;
      for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!fg[i] && !out[i]) { out[i] = 1; q[qt++] = i; } }
      for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!fg[i] && !out[i]) { out[i] = 1; q[qt++] = i; } }
      while (qh < qt) { const i = q[qh++], x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (!fg[j] && !out[j]) { out[j] = 1; q[qt++] = j; } } }
      const seen = new Uint8Array(N), maxHole = drawing ? N : Math.max(400, area * 0.01);
      for (let i = 0; i < N; i++) {
        if (fg[i] || out[i] || seen[i]) continue;
        const reg = []; qh = 0; qt = 0; q[qt++] = i; seen[i] = 1;
        while (qh < qt) { const p = q[qh++], x = p % W, y = (p - x) / W; reg.push(p); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (!fg[j] && !out[j] && !seen[j]) { seen[j] = 1; q[qt++] = j; } } }
        if (reg.length <= maxHole) for (const p of reg) fg[p] = 1;
      }
    }
    if (drawing) fg = morph(fg, W, H, 3, false);   // sit the outline on the drawn line, not beside it
    // Outline: the subject's boundary loops, smoothed lightly.
    const r1 = (v) => String(Math.round(v / f * 10) / 10);
    const toL = (pts, closed) => 'M' + pts.map(([x, y]) => r1(x) + ' ' + r1(y)).join('L') + (closed ? 'Z' : '');
    // Smooth curves through the points (Catmull-Rom as cubic Béziers), keeping sharp corners sharp.
    const toD = (pts, closed, straight = 0) => {
      const n = pts.length; if (n < 3) return toL(pts, closed);
      const segLen = (i) => { const a = pts[(i + n) % n], b = pts[(i + 1 + n) % n]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };
      const P = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
      const corner = (i) => { if (!closed && (i === 0 || i === n - 1)) return true; if (straight && (segLen(i - 1) > straight || segLen(i) > straight)) return true; const a = P(i - 1), b = P(i), c = P(i + 1);
        const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]], l = Math.hypot(...v1) * Math.hypot(...v2) || 1;
        return (v1[0] * v2[0] + v1[1] * v2[1]) / l < 0.55; };
      let d = 'M' + r1(pts[0][0]) + ' ' + r1(pts[0][1]);
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        const c1 = corner(i) ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = corner(i + 1) ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += c1 === p1 && c2 === p2 ? 'L' + r1(p2[0]) + ' ' + r1(p2[1]) : 'C' + [c1, c2, p2].map(([x, y]) => r1(x) + ' ' + r1(y)).join(' ');
      }
      return d + (closed ? 'Z' : '');
    };
    // Tolerance for simplifying: smaller for small shapes (windows stay round).
    const tol = (pts, base) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return Math.max(0.6, Math.min(base, L / 45)); };
    const outline = [];
    for (const lp of contours(fg, W, H).filter((l) => l.length >= 24).sort((p, q2) => q2.length - p.length)) {
      const clean = level !== 'detailed';
      const sm = clean ? smooth(smooth(smooth(lp, true, 4), true, 3), true, 2) : smooth(smooth(lp, true, 3), true, 2);
      let v = rdp(sm.concat([sm[0]]), tol(sm, clean ? 2.6 : 1.0)).slice(0, -1);
      if (clean) {
        // Drafted look: long edges that are nearly level or upright become exactly level / upright.
        for (let pass = 0; pass < 2; pass++) for (let i = 0; i < v.length; i++) {
          const a = v[i], b = v[(i + 1) % v.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
          if (L < 0.035 * W) continue;
          if (Math.abs(dy) / L < 0.06) { const m = (a[1] + b[1]) / 2; v[i] = [a[0], m]; v[(i + 1) % v.length] = [b[0], m]; }
          else if (Math.abs(dx) / L < 0.06) { const m = (a[0] + b[0]) / 2; v[i] = [m, a[1]]; v[(i + 1) % v.length] = [m, b[1]]; }
        }
      }
      outline.push(toD(v, true, clean ? 0.05 * W : 0));
    }

    // Details inside the subject.
    const inner = morph(fg, W, H, drawing ? 4 : 3, false);
    // Lettering, logos and markings Claude boxed are left out of the details (the outline is untouched).
    for (const [ex, ey, ew, eh] of (loc.erase || []).slice(0, 30)) {
      for (let y = clamp(Math.round(ey * f), 0, H); y < clamp(Math.round((ey + eh) * f), 0, H); y++) for (let x = clamp(Math.round(ex * f), 0, W); x < clamp(Math.round((ex + ew) * f), 0, W); x++) inner[y * W + x] = 0;
    }
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
      detail = chainsOf(edge, W, H, level === 'detailed' ? 14 : 34).filter((pts) => {
        // Skip squiggles (texture, noise): keep long or fairly straight runs.
        const s = pts[0], e = pts[pts.length - 1], span = Math.hypot(e[0] - s[0], e[1] - s[1]);
        return !(pts.length < 40 && pts.length > 2.6 * Math.max(span, 1));
      }).map((pts) => { let s = 0; for (const [x, y] of pts) s += mag[y * W + x]; return { pts, str: (s / pts.length) * Math.sqrt(pts.length) }; });
    }
    detail.sort((p, q2) => q2.str - p.str);
    detail = detail.slice(0, opts.pool ? 220 : level === 'detailed' ? 400 : 90);

    // ---------- Smart cleanup: how an illustrator would redraw the real lines ----------
    // 1. Drop double edges (both sides of one thin feature) and lines hugging the outline.
    const occ = new Uint8Array(N);
    const stamp = (pts, r) => { for (const [x, y] of pts) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = Math.round(x) + dx, yy = Math.round(y) + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) occ[yy * W + xx] = 1; } };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (fg[i] && (x === 0 || !fg[i - 1] || !fg[i + 1] || !fg[i - W] || !fg[i + W])) stamp([[x, y]], 3); }
    let lines = [];
    for (const d of detail) {
      let cov = 0; for (const [x, y] of d.pts) if (occ[y * W + x]) cov++;
      if (cov > 0.7 * d.pts.length) continue;
      lines.push(d); stamp(d.pts, 3);
    }
    // 2. Join broken pieces whose ends meet and point the same way.
    const dirAt = (pts, end) => { const n = pts.length, k = Math.min(8, n - 1); const a = end ? pts[n - 1 - k] : pts[k], b = end ? pts[n - 1] : pts[0]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    for (let pass = 0; pass < 3; pass++) {
      let joined = false;
      for (let i = 0; i < lines.length && !joined; i++) for (let j = 0; j < lines.length && !joined; j++) {
        if (i === j) continue;
        const A = lines[i].pts, B = lines[j].pts;
        for (const [ea, eb] of [[true, false], [true, true], [false, false], [false, true]]) {
          const pa = ea ? A[A.length - 1] : A[0], pb = eb ? B[B.length - 1] : B[0];
          const gap = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); if (gap > 9) continue;
          const da = dirAt(A, ea), db = dirAt(B, eb);
          if (da[0] * -db[0] + da[1] * -db[1] < 0.8) continue;   // must continue in the same direction
          const a2 = ea ? A : A.slice().reverse(), b2 = eb ? B.slice().reverse() : B;
          lines[i] = { pts: a2.concat(b2), str: lines[i].str + lines[j].str }; lines.splice(j, 1); joined = true; break;
        }
      }
      if (!joined) break;
    }
    // 3. Fit clean shapes: straight lines stay straight, round windows become true ellipses, the rest smooth curves.
    const fitShape = (pts) => {
      const n = pts.length; let L = 0; for (let i = 1; i < n; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= n; my /= n;
      let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); } sxx /= n; syy /= n; sxy /= n;
      const tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
      const closed = Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) < Math.max(5, 0.08 * L);
      // Straight line: tiny spread across the main direction.
      if (!closed && Math.sqrt(Math.max(0, l2)) < Math.max(1.0, 0.012 * L)) {
        let t0 = Infinity, t1 = -Infinity; for (const [x, y] of pts) { const t = (x - mx) * ux + (y - my) * uy; t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
        return { kind: 'line', d: toL([[mx + ux * t0, my + uy * t0], [mx + ux * t1, my + uy * t1]], false), L };
      }
      // Ellipse: closed and every point near the fitted ellipse.
      if (closed && n >= 16) {
        const a = Math.sqrt(2 * l1), b = Math.sqrt(2 * Math.max(l2, 0.01));
        let err = 0; for (const [x, y] of pts) { const u = ((x - mx) * ux + (y - my) * uy) / a, v = (-(x - mx) * uy + (y - my) * ux) / b; err += Math.abs(Math.hypot(u, v) - 1); }
        if (err / n < 0.09 && b / a > 0.25) {
          const deg = Math.round(ang * 180 / Math.PI), ra = r1(a), rb = r1(b), p1 = [mx + ux * a, my + uy * a], p2 = [mx - ux * a, my - uy * a];
          return { kind: 'ellipse', d: `M${r1(p1[0])} ${r1(p1[1])}A${ra} ${rb} ${deg} 1 0 ${r1(p2[0])} ${r1(p2[1])}A${ra} ${rb} ${deg} 1 0 ${r1(p1[0])} ${r1(p1[1])}Z`, L };
        }
      }
      const sp = smooth(pts, closed, level === 'detailed' ? 1 : 3);
      return { kind: 'curve', d: toD(rdp(sp, tol(sp, level === 'detailed' ? 1.2 : 2.2)), closed), L };
    };
    const cands = lines.map((l, i) => {
      const sh = fitShape(l.pts), m = l.pts[Math.floor(l.pts.length / 2)];
      return { id: i + 1, d: sh.d, kind: sh.kind, len: Math.round(sh.L / f), mid: [Math.round(m[0] / f), Math.round(m[1] / f)], str: l.str };
    });
    const keepN = level === 'detailed' ? cands.length : Math.min(cands.length, 45);
    const auto = cands.slice(0, keepN);
    const cut = Math.max(1, Math.round(auto.length * (level === 'detailed' ? 0.35 : 0.6)));
    return { ok: true, frac, dbg: {}, H: Math.round(H / f), outline: pack(outline), strong: pack(auto.slice(0, cut).map((c) => c.d)), weak: pack(auto.slice(cut).map((c) => c.d)), cands };
  }

  // Rewrite absolute path data with x' = x * k + dx, y' = y * k + dy (arc radii scale by k).
  const ARGS = { M: 'xy', L: 'xy', T: 'xy', H: 'x', V: 'y', C: 'xyxyxy', S: 'xyxy', Q: 'xyxy', A: 'rrafxy', Z: '' };
  function mapD(d, k, dx, dy) {
    const toks = d.match(/[MLHVCSQTAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || []; const out = []; let cmd = '', pat = '', i = 0;
    const r1 = (v) => String(Math.round(v * 10) / 10);
    for (const t of toks) {
      if (/^[A-Z]$/i.test(t)) { cmd = t.toUpperCase(); pat = ARGS[cmd] || ''; i = 0; out.push(cmd); continue; }
      if (!pat) continue;
      const v = parseFloat(t), role = cmd === 'A' ? 'rrafxy'[i % 7 === 6 ? 5 : i % 7] : pat[i % pat.length];
      let w;
      if (cmd === 'A') { const j = i % 7; w = j < 2 ? v * k : j < 5 ? v : j === 5 ? v * k + dx : v * k + dy; }
      else w = role === 'x' ? v * k + dx : v * k + dy;
      out.push(r1(w)); i++;
    }
    return out.join(' ').replace(/ ?([MLHVCSQTAZ]) /g, '$1');
  }
  // Trace a crop around the subject at full detail (a helicopter that fills a third of the photo gets
  // three times the pixels), then map the result back to the whole photo's coordinates.
  async function trace(src, loc, level = 'clean', opts = {}) {
    const img = typeof src === 'string' ? await loadImg(src) : src;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, uH = 600 * ih / iw;
    if (!loc.box || loc.box[2] > 480) return withDetail(img, loc, await traceRaw(img, loc, level, opts), level, opts);
    const [bx, by, bw, bh] = loc.box, pad = 0.12 * Math.max(bw, bh);
    const cx0 = Math.max(0, bx - pad), cy0 = Math.max(0, by - pad), cx1 = Math.min(600, bx + bw + pad), cy1 = Math.min(uH, by + bh + pad);
    const cw = cx1 - cx0, ch = cy1 - cy0, px = iw / 600;
    const OUTW = Math.min(1800, Math.max(1200, Math.round(cw * px)));   // never shrink the subject below its real pixels
    const cv = document.createElement('canvas'); cv.width = OUTW; cv.height = Math.max(40, Math.round(OUTW * ch / cw));
    cv.getContext('2d').drawImage(img, cx0 * px, cy0 * px, cw * px, ch * px, 0, 0, cv.width, cv.height);
    cv.naturalWidth = cv.width; cv.naturalHeight = cv.height;
    const s = 600 / cw;   // full-photo units -> crop units
    const P = ([x, y]) => [(x - cx0) * s, (y - cy0) * s];
    const L2 = Object.assign({}, loc, {
      box: [(bx - cx0) * s, (by - cy0) * s, bw * s, bh * s],
      inside: (loc.inside || []).map(P), outside: (loc.outside || []).map(P),
      erase: (loc.erase || []).map(([x, y, w, h]) => [(x - cx0) * s, (y - cy0) * s, w * s, h * s]),
      rotors: (loc.rotors || []).map((r) => Object.assign({}, r, { hub: P(r.hub), r: r.r * s }))
    });
    if (loc.ai && loc.ai.length === 320 * 320) {   // resample the AI map to the crop
      const a = new Float32Array(320 * 320), ai = loc.ai;
      for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
        const fx = Math.min(319, Math.max(0, ((cx0 + (x + 0.5) / 320 * cw) / 600) * 320 - 0.5)), fy = Math.min(319, Math.max(0, ((cy0 + (y + 0.5) / 320 * ch) / uH) * 320 - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(319, x0 + 1), y1 = Math.min(319, y0 + 1), ax = fx - x0, ay = fy - y0;
        a[y * 320 + x] = (ai[y0 * 320 + x0] * (1 - ax) + ai[y0 * 320 + x1] * ax) * (1 - ay) + (ai[y1 * 320 + x0] * (1 - ax) + ai[y1 * 320 + x1] * ax) * ay;
      }
      L2.ai = a;
    }
    const r = await traceRaw(cv, L2, level, opts);
    if (!r.ok) return r;
    const back = (d) => mapD(d, 1 / s, cx0, cy0);
    const out = Object.assign({}, r, { H: Math.round(uH), outline: r.outline.map(back), strong: r.strong.map(back), weak: r.weak.map(back),
      cands: (r.cands || []).map((c) => Object.assign({}, c, { d: back(c.d), len: Math.round(c.len / s), mid: [Math.round(c.mid[0] / s + cx0), Math.round(c.mid[1] / s + cy0)] })) });
    return withDetail(img, loc, out, level, opts);
  }
  // Detail areas (cockpit, intakes...): trace each one again zoomed in, and use those finer lines there.
  async function withDetail(img, loc, r, level, opts) {
    const iou = (a, b) => { const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])), y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])), i = x * y; return i / (a[2] * a[3] + b[2] * b[3] - i); };
    const zones = [];
    for (const b of (opts.detail || [])) if (Array.isArray(b) && b.length === 4 && b[2] > 3 && b[3] > 3 && !zones.some((z) => iou(z, b) > 0.35)) zones.push(b);
    zones.splice(4);
    if (!zones.length) return r;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, uH = 600 * ih / iw, px = iw / 600;
    const inZone = (m) => zones.some(([x, y, w, h]) => m[0] >= x && m[0] <= x + w && m[1] >= y && m[1] <= y + h);
    let cands = (r.cands || []).filter((c) => !inZone(c.mid));
    for (const [zx, zy, zw, zh] of zones) {
      const pad = 0.06 * Math.max(zw, zh), cx0 = Math.max(0, zx - pad), cy0 = Math.max(0, zy - pad), cx1 = Math.min(600, zx + zw + pad), cy1 = Math.min(uH, zy + zh + pad);
      const cw = cx1 - cx0, ch = cy1 - cy0, s = 600 / cw;
      const OUTW = Math.max(900, Math.min(1600, Math.round(cw * px * 2)));
      const cv = document.createElement('canvas'); cv.width = OUTW; cv.height = Math.max(40, Math.round(OUTW * ch / cw));
      cv.getContext('2d').drawImage(img, cx0 * px, cy0 * px, cw * px, ch * px, 0, 0, cv.width, cv.height);
      cv.naturalWidth = cv.width; cv.naturalHeight = cv.height;
      const maskD = r.outline.map((d) => mapD(d, s, -cx0 * s, -cy0 * s));
      const erase = (loc.erase || []).map(([x, y, w, h]) => [(x - cx0) * s, (y - cy0) * s, w * s, h * s]);
      let z;
      try { z = await traceRaw(cv, { kind: loc.kind, box: [0, 0, 600, ch * s], inside: [], outside: [], erase, rotors: [] }, 'detailed', { maskD, pool: true }); } catch (e) { continue; }
      if (!z || !z.ok) continue;
      const back = (d) => mapD(d, 1 / s, cx0, cy0);
      // Glazing: find the glass (whatever differs clearly from the painted skin) and outline each pane.
      try {
        const W2 = cv.width, H2 = cv.height, N2 = W2 * H2, g2 = cv.getContext('2d', { willReadFrequently: true }), pxd = g2.getImageData(0, 0, W2, H2).data;
        const mk = document.createElement('canvas'); mk.width = W2; mk.height = H2; const mg = mk.getContext('2d', { willReadFrequently: true });
        const k2 = W2 / 600; mg.scale(k2, k2); mg.fillStyle = '#fff'; for (const d of maskD) { try { mg.fill(new Path2D(d)); } catch (e) {} }
        const md = mg.getImageData(0, 0, W2, H2).data; let inside = new Uint8Array(N2); for (let i = 0; i < N2; i++) inside[i] = md[i * 4 + 3] > 127 ? 1 : 0;
        inside = morph(inside, W2, H2, Math.round(0.006 * W2) + 2, false);
        const rs = [], gs = [], bs = []; for (let i = 0; i < N2; i += 7) if (inside[i]) { rs.push(pxd[i * 4]); gs.push(pxd[i * 4 + 1]); bs.push(pxd[i * 4 + 2]); }
        if (rs.length > 200) {
          const paint = [pct(rs, 0.5), pct(gs, 0.5), pct(bs, 0.5)];
          const dist = new Float32Array(N2), dv = [];
          for (let i = 0; i < N2; i++) if (inside[i]) { dist[i] = Math.hypot(pxd[i * 4] - paint[0], pxd[i * 4 + 1] - paint[1], pxd[i * 4 + 2] - paint[2]); if (i % 5 === 0) dv.push(dist[i]); }
          // Otsu split of colour distance: paint vs glass.
          const hist = new Float64Array(256); for (const v of dv) hist[Math.min(255, v | 0)]++;
          let sum = 0, tot = dv.length; for (let i = 0; i < 256; i++) sum += i * hist[i];
          let sB = 0, wB = 0, best = 0, thr = 60;
          for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = i; } }
          thr = Math.max(thr, 45);
          let glass = new Uint8Array(N2); for (let i = 0; i < N2; i++) glass[i] = inside[i] && dist[i] > thr ? 1 : 0;
          const rr = Math.max(2, Math.round(0.004 * W2));
          glass = morph(morph(glass, W2, H2, rr, true), W2, H2, rr, false);          // close: fill reflections and seams inside a pane
          glass = morph(morph(glass, W2, H2, rr + 1, false), W2, H2, rr + 1, true);  // open: drop specks and thin lines
          const kpx = W2 / 600 * s;   // crop pixels per full-photo unit
          for (const lp of contours(glass, W2, H2).filter((l) => l.length > 0.06 * W2)) {
            let area = 0; for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; area += a[0] * b[1] - b[0] * a[1]; }
            area = Math.abs(area) / 2; if (area < 0.002 * N2 || area > 0.5 * N2) continue;
            // Window panes are convex: complete the shape where reflections or the crew hide part of the glass.
            const hull = (pts) => { const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
              const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
              for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
              return lo.slice(0, -1).concat(up.slice(0, -1)); };
            const hl = hull(lp); let ha = 0; for (let i = 0; i < hl.length; i++) { const a = hl[i], b = hl[(i + 1) % hl.length]; ha += a[0] * b[1] - b[0] * a[1]; } ha = Math.abs(ha) / 2;
            let shape = lp;
            if (area / ha > 0.45) {   // mostly solid: use the convex outline, but only where it stays on the aircraft
              let ok = 0, n = 0; for (let i = 0; i < hl.length; i++) { const a = hl[i], b = hl[(i + 1) % hl.length]; for (let t = 0; t < 1; t += 0.1) { const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t); n++; if (x >= 0 && y >= 0 && x < W2 && y < H2 && md[(y * W2 + x) * 4 + 3] > 127) ok++; } }
              if (ok > 0.92 * n) { shape = []; for (let i = 0; i < hl.length; i++) { const a = hl[i], b = hl[(i + 1) % hl.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / 3)); for (let j = 0; j < k; j++) shape.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); } }
            }
            const sm = smooth(smooth(shape, true, 3), true, 2), v = rdp(sm.concat([sm[0]]), Math.max(1.2, 0.004 * W2)).slice(0, -1);
            if (v.length < 3) continue;
            const r1 = (x) => String(Math.round(x * 10) / 10);
            const d = 'M' + v.map(([x, y]) => r1(x / k2) + ' ' + r1(y / k2)).join('L') + 'Z';
            let mx = 0, my = 0; for (const [x, y] of v) { mx += x; my += y; } mx /= v.length; my /= v.length;
            const mid = [Math.round(mx / k2 / s + cx0), Math.round(my / k2 / s + cy0)];
            if (inZone(mid)) cands.push({ d: back(d), kind: 'pane', len: Math.round(lp.length / kpx), mid, zone: true, pane: true });
          }
        }
      } catch (e) { /* glazing is a bonus */ }
      for (const c of (z.cands || []).slice(0, 60)) {
        const mid = [Math.round(c.mid[0] / s + cx0), Math.round(c.mid[1] / s + cy0)];
        if (!inZone(mid)) continue;
        cands.push(Object.assign({}, c, { d: back(c.d), len: Math.round(c.len / s), mid, zone: true }));
      }
    }
    cands = cands.map((c, i) => Object.assign({}, c, { id: i + 1 }));
    return Object.assign({}, r, { cands, zones });
  }

  return { trace };
})();
