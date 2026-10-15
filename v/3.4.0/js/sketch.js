// Minimal sketches: simple vector line art drawn by the app itself.
// Every background shares one look (colors, glow, lettering) chosen in settings, so everything stays on theme.
const Sketch = (() => {
  // Built-in subjects: viewBox size [w, h], strokes, circles, and faint ground/horizon lines.
  const SUBJECTS = {
    cybertruck: {
      name: 'Cybertruck', size: [600, 230],
      paths: [
        'M28 166 L28 124 L54 113 L232 34 L568 94 L572 166 L514 166 L500 126 L418 126 L404 166 L204 166 L190 126 L108 126 L94 166 Z',
        'M120 108 L232 56 L380 82 L380 108 Z',
        'M28 124 L64 122'
      ],
      circles: [[149, 170, 34], [459, 170, 34], [149, 170, 11], [459, 170, 11]],
      faint: ['M-200 204 L800 204']
    },
    lightcycle: {
      name: 'Light-cycle', size: [600, 230],
      paths: [
        'M70 148 C 70 96, 104 80, 150 80 L 292 96 C 318 64, 382 58, 424 82 L 462 82 C 526 84, 542 118, 540 148',
        'M206 156 L 404 156',
        'M292 96 L 300 138 L 330 138'
      ],
      circles: [[140, 148, 66], [470, 148, 66], [140, 148, 50], [470, 148, 50]],
      faint: ['M-200 214 L800 214']
    },
    airliner: {
      name: 'Airliner', size: [600, 220],
      paths: [
        'M44 128 C 44 112, 62 104, 92 104 L 468 104 C 522 104, 562 116, 574 128 C 562 140, 526 148, 468 148 L 92 148 C 62 148, 44 142, 44 128 Z',
        'M78 104 L 46 36 L 76 36 L 140 104',
        'M262 146 L 318 198 L 350 198 L 330 146',
        'M534 114 L 558 121'
      ],
      circles: [],
      faint: []
    },
    monorail: {
      name: 'Monorail', size: [600, 240],
      paths: [
        'M60 160 L60 110 Q 60 96 74 96 L 466 96 C 522 96, 560 122, 568 160 Z',
        'M300 96 L300 160',
        'M524 104 C 546 114, 558 128, 562 144',
        'M90 116 L 270 116 M330 116 L 490 116'
      ],
      circles: [],
      faint: ['M-200 170 L800 170', 'M-200 182 L800 182', 'M150 182 L150 240', 'M450 182 L450 240']
    },
    skyline: {
      name: 'City skyline', size: [600, 230],
      paths: [
        'M0 200 H40 V150 H70 V120 H92 V165 H125 V95 L140 42 L155 95 V185 H190 V130 H220 V100 H245 V150 H270 V62 L285 8 L300 62 V140 H330 V110 H360 V170 H395 V90 L410 50 L425 90 V160 H455 V125 H485 V175 H520 V140 H550 V190 H600'
      ],
      circles: [],
      faint: ['M-200 200 L800 200', 'M60 218 H180 M300 218 H470']
    },
    castle: {
      name: 'Castle on a cliff', size: [600, 250],
      paths: [
        'M0 228 L110 228 L150 188 L166 150 L470 150 L494 186 L540 228 L600 228',
        'M192 150 V92 L206 58 L220 92 V150',
        'M252 150 V72 L271 28 L290 72 V150',
        'M300 150 V112 H380 V150',
        'M392 150 V86 L406 52 L420 86 V150',
        'M440 150 V104 H462 V150'
      ],
      circles: [],
      faint: ['M-200 236 L800 236', 'M60 246 H150 M310 246 H430']
    },
    drone: {
      name: 'Drone', size: [600, 200], zoom: 1.6,
      paths: [
        'M250 110 H350 L338 132 H262 Z',
        'M258 112 L182 94 M342 112 L418 94',
        'M138 86 H226 M374 86 H462',
        'M182 86 V96 M418 86 V96',
        'M272 132 L262 160 M328 132 L338 160'
      ],
      circles: [[300, 140, 7]],
      faint: []
    },
    fighter: {
      name: 'Fighter jet', size: [600, 250],
      paths: [
        'M300 18 L318 70 L322 110 L470 160 L470 175 L330 168 L345 205 L360 215 L360 226 L310 219 L300 232 L290 219 L240 226 L240 215 L255 205 L270 168 L130 175 L130 160 L278 110 L282 70 Z',
        'M300 44 C 311 56, 311 76, 300 88 C 289 76, 289 56, 300 44'
      ],
      circles: [],
      faint: []
    },
    mountains: {
      name: 'Mountains', size: [600, 230],
      paths: [
        'M0 200 L90 120 L140 150 L230 58 L300 130 L350 100 L450 172 L520 122 L600 182'
      ],
      circles: [[440, 66, 22]],
      faint: ['M0 216 L120 172 L210 196 L330 152 L430 190 L520 162 L600 202']
    },
    cruise: {
      name: 'Cruise ship', size: [600, 230],
      paths: [
        'M30 150 L570 150 L540 196 L74 196 Q 48 186 30 150 Z',
        'M70 150 L70 122 L520 122 L546 150',
        'M112 122 L112 98 L470 98 L496 122',
        'M164 98 L164 78 L420 78 L442 98',
        'M286 78 L294 46 L340 46 L348 78',
        'M96 172 H 512'
      ],
      circles: [],
      faint: ['M-200 206 L800 206']
    }
  };

  // Looks. "neon" glows in the chosen accent color; the others are flat, Apple-style.
  const LOOKS = {
    neon: { name: 'Neon glow on black', glow: true, width: 2.4 },
    dark: { name: 'White on black', glow: false, width: 2, bg: '#000000', stroke: '#f5f5f7', text: '#f5f5f7', light: false },
    light: { name: 'Black on white', glow: false, width: 2, bg: '#f5f5f7', stroke: '#1d1d1f', text: '#1d1d1f', light: true }
  };
  const ACCENTS = {
    blue: { name: 'Electric blue', stroke: '#5cc8ff', text: '#bfe8ff', tint: '#0b1d3a' },
    cyan: { name: 'Cyan', stroke: '#3ff0ff', text: '#c8fbff', tint: '#062a33' },
    violet: { name: 'Violet', stroke: '#b493ff', text: '#e2d6ff', tint: '#1c0f3a' },
    amber: { name: 'Amber', stroke: '#ffbe5c', text: '#ffe6bf', tint: '#2b1a06' },
    mint: { name: 'Mint', stroke: '#5cffb4', text: '#c9ffe6', tint: '#062a1d' },
    red: { name: 'Red', stroke: '#ff5c6c', text: '#ffd0d5', tint: '#2b0710' }
  };

  // Resolve the colors for a look (+ accent for neon).
  function theme(look = {}) {
    const l = LOOKS[look.style] || LOOKS.neon;
    if (!l.glow) return l;
    const a = ACCENTS[look.accent] || ACCENTS.blue;
    return { ...l, stroke: a.stroke, text: a.text, light: false,
      bg: `radial-gradient(ellipse at 50% 55%, ${a.tint} 0%, #050b18 55%, #010206 100%)` };
  }

  const PATH_OK = /^[MLHVCSQTAZ0-9.,\s-]+$/;
  const safe = (arr) => (arr || []).filter((d) => typeof d === 'string' && PATH_OK.test(d));
  const num = (x) => typeof x === 'number' && isFinite(x);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cleanText = (t) => String(t || '').replace(/[^\p{L}\p{N} .,'!?&:-]/gu, '').trim().toUpperCase().slice(0, 24);

  // Full-screen SVG (1920x1080 frame, scales to fill any screen).
  // sk = { subject, custom?, text? }; look = { style, accent, textPos, animate }.
  function render(sk, look = {}, { thumb = false } = {}) {
    const base = sk.custom || SUBJECTS[sk.subject] || SUBJECTS.cybertruck;
    const subj = { ...base, paths: safe(base.paths), faint: safe(base.faint),
      circles: (base.circles || []).filter((c) => Array.isArray(c) && c.length === 3 && c.every(num)) };
    const size = Array.isArray(subj.size) && subj.size.every(num) ? subj.size : [600, 230];
    const st = theme(look);
    const animate = look.animate !== false && !thumb;
    const [w, h] = size;
    const scale = ((thumb ? 1100 : 760) / w) * (num(subj.zoom) ? subj.zoom : 1);
    const x = 960 - (w / 2) * scale;
    const text = cleanText(sk.text);
    const below = look.textPos === 'below';
    const y = 600 - (h * scale) / 2 + (text ? (below ? -30 : 40) : 0);
    let i = 0;
    const count = subj.faint.length + subj.paths.length + subj.circles.length;
    const step = Math.min(0.35, 3 / Math.max(1, count)); // detailed sketches still finish drawing in ~3-4 s
    const anim = () => (animate ? ` class="d" style="animation-delay:${(0.15 + step * i++).toFixed(2)}s"` : '');
    const strokes = [
      ...subj.faint.map((d) => `<path d="${d}" pathLength="1" opacity="${num(subj.weight) ? '.5' : '.28'}"${anim()}/>`),
      ...subj.paths.map((d) => `<path d="${d}" pathLength="1"${anim()}/>`),
      ...subj.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" pathLength="1"${anim()}/>`)
    ].join('');
    const glow = st.glow
      ? '<filter id="g" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      : '';
    const css = animate
      ? `<style>.d{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.8s cubic-bezier(.6,.05,.3,1) forwards}
         .t{opacity:0;animation:fade 1.6s ease forwards;animation-delay:${(0.4 + step * i).toFixed(2)}s}
         @keyframes draw{to{stroke-dashoffset:0}}@keyframes fade{to{opacity:1}}
         @media (prefers-reduced-motion: reduce){.d,.t{animation:none;stroke-dashoffset:0;opacity:1}}</style>`
      : '';
    const ty = below ? Math.round(y + h * scale + 120) : Math.round(y - 70);
    const word = text
      ? `<text x="960" y="${ty}" text-anchor="middle" class="${animate ? 't' : ''}" fill="${st.text}"
           font-family="'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="300" font-size="${thumb ? 64 : 44}"
           letter-spacing="26" ${st.glow ? 'filter="url(#g)"' : ''}>${esc(text)}</text>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <defs>${glow}</defs>${css}
      <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="none" stroke="${st.stroke}"
         stroke-width="${((thumb ? st.width * 2.6 : st.width) * (num(subj.weight) ? subj.weight : 1) / scale).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"
         ${st.glow ? 'filter="url(#g)"' : ''}>${strokes}</g>
      ${word}</svg>`;
  }

  const background = (look) => theme(look).bg;
  const isLight = (look) => !!theme(look).light;

  // ---------- "Surprise me": new drawings made on this computer, in the same style ----------

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const f = (n) => n.toFixed(1);
  const between = (r, a, b) => a + (b - a) * r();

  const GENERATORS = {
    ridge: { name: 'Mountain range', make(r) {
      const pts = []; let x = 0, up = true;
      pts.push([0, between(r, 175, 200)]);
      while (x < 600) {
        x += between(r, 55, 105);
        pts.push([Math.min(x, 600), up ? between(r, 30, 105) : between(r, 120, 165)]);
        up = !up;
      }
      pts[pts.length - 1][1] = between(r, 170, 200);
      const back = []; x = 0;
      while (x <= 600) { back.push([x, between(r, 150, 205)]); x += between(r, 70, 130); }
      back.push([600, between(r, 170, 205)]);
      const sun = r() < 0.75 ? [[f(between(r, 90, 510)) * 1, f(between(r, 30, 70)) * 1, f(between(r, 14, 26)) * 1]] : [];
      return { size: [600, 230], paths: ['M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L')],
        circles: sun, faint: ['M' + back.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L')] };
    } },
    waves: { name: 'Ocean waves', make(r) {
      const lines = [];
      const rows = 3;
      for (let k = 0; k < rows; k++) {
        const y = 140 + k * 30, amp = between(r, 10, 16) * (1 - k * 0.2), len = between(r, 150, 210);
        let d = `M0 ${f(y)}`;
        for (let x = 0; x < 600; x += len) d += ` Q ${f(x + len / 4)} ${f(y - amp)} ${f(x + len / 2)} ${f(y)} T ${f(Math.min(x + len, 600))} ${f(y)}`;
        lines.push(d);
      }
      const sx = between(r, 180, 420), sr = between(r, 46, 64);
      const sun = `M${f(sx - sr)} 116 A ${f(sr)} ${f(sr)} 0 0 1 ${f(sx + sr)} 116`;
      return { size: [600, 230], paths: [sun, ...lines.slice(0, 2)], circles: [], faint: ['M-200 116 L800 116', ...lines.slice(2)] };
    } },
    city: { name: 'City skyline', make(r) {
      let x = 0, d = `M0 ${f(between(r, 185, 200))}`;
      while (x < 600) {
        const bw = between(r, 22, 48), bh = between(r, 60, 175), top = 200 - bh;
        d += ` H${f(x)} V${f(top)}`;
        if (r() < 0.22) d += ` L${f(x + bw / 2)} ${f(top - between(r, 20, 50))} L${f(x + bw)} ${f(top)}`;
        else d += ` H${f(x + bw)}`;
        x += bw; d += ` V${f(between(r, 185, 200))}`;
      }
      d += ' H600';
      return { size: [600, 230], paths: [d], circles: r() < 0.5 ? [[f(between(r, 60, 540)) * 1, 30, 12]] : [],
        faint: ['M-200 200 L800 200', `M${f(between(r, 40, 120))} 218 H${f(between(r, 180, 260))} M${f(between(r, 320, 380))} 218 H${f(between(r, 460, 540))}`] };
    } },
    stars: { name: 'Constellation', make(r) {
      const n = 6 + Math.floor(r() * 4), pts = [];
      for (let k = 0; k < n; k++) pts.push([between(r, 60 + k * (480 / n), 60 + (k + 1) * (480 / n)), between(r, 30, 200)]);
      const path = 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
      const branch = `M${f(pts[2][0])} ${f(pts[2][1])} L${f(between(r, 150, 450))} ${f(between(r, 20, 210))}`;
      const circles = pts.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, Math.round(between(r, 3, 6) * 10) / 10]);
      return { size: [600, 230], zoom: 1.25, paths: [path, branch], circles, faint: [] };
    } },
    planet: { name: 'Planet', make(r) {
      const cx = 300, cy = 115, R = between(r, 48, 66), rx = R * between(r, 1.7, 2.1), ry = R * between(r, 0.32, 0.45);
      const ring = `M${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cy)}`;
      const ringBack = `M${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(cy)}`;
      const mx = between(r, 60, 140) * (r() < 0.5 ? 1 : -1);
      return { size: [600, 230], zoom: 1.6, paths: [ring], circles: [[cx, cy, Math.round(R * 10) / 10], [Math.round((cx + rx + mx * 0.6) * 10) / 10, Math.round(between(r, 30, 200) * 10) / 10, 7]],
        faint: [ringBack] };
    } }
  };

  function generate(kind, seed = Math.floor(Math.random() * 2 ** 31)) {
    const keys = Object.keys(GENERATORS);
    const k = GENERATORS[kind] ? kind : keys[seed % keys.length];
    const g = GENERATORS[k];
    const out = g.make(rng(seed));
    return { id: 'g' + seed.toString(36), name: g.name, kind: k, ...out };
  }

  return { SUBJECTS, LOOKS, ACCENTS, GENERATORS, render, background, isLight, generate, cleanText };
})();
