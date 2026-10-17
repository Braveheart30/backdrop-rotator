// Minimal sketches: simple vector line art drawn by the app itself.
// Every background shares one look (colors, glow, lettering) chosen in settings, so everything stays on theme.
const Sketch = (() => {
  // Built-in subjects: viewBox size [w, h], strokes, circles, and faint ground/horizon lines.
  const SUBJECTS = {
    // Traced from a public-domain U.S. Army (DVIDS) photo of a CH-47F.
    chinook: {
      name: 'CH-47 Chinook', size: [600, 240], zoom: 1.25, weight: 0.8,
      paths: [
        'M91.5 184.9 L131.6 191.9 L494.6 191.9 L515.5 180.5 C537.3 170.1 560.9 148.3 559.1 131.7 L550.4 117.7 L545.2 58.4 Q544.3 46.2 534.7 45.3 L437.0 47.0 Q430.9 47.9 430.0 54.9 L414.3 105.5 L179.6 96.8 L179.6 77.6 L136.0 60.1 L93.2 60.1 Q87.1 61.0 87.1 67.1 L86.2 103.8 L82.8 105.5 L68.8 131.7 Q57.4 133.4 50.5 137.8 Q40.9 143.9 40.0 157.0 Q40.0 171.8 54.8 177.0 Q72.3 182.3 91.5 184.9 Z',
        'M70.5 130.8 L78.4 109.9 L86.2 108.1 L80.1 133.4 ZM87.1 116.8 L98.5 116.8 L96.7 136.9 L85.4 136.9 ZM100.2 116.8 L109.8 117.7 L107.2 136.9 L98.5 136.9 ZM81.0 140.4 L105.4 140.4 L100.2 162.2 L74.9 162.2 ZM50.5 138.7 L74.0 142.1 M78.4 137.8 L66.2 177.0 M47.0 143.0 Q44.4 157.9 48.7 171.8 M87.1 105.5 L105.4 103.8 L106.3 112.5 L87.1 113.4 Z',
        'M118.5 66.2 H138.6 V76.7 H118.5 Z',
        'M120.3 51.4 H143.0 M130.7 51.4 V60.1 M489.3 36.6 H510.3 M499.8 36.6 V45.3',
        'M146.4 116.0 H183.1 V177.0 H146.4 ZM143.8 180.5 H182.2 V205.0 H143.8 Z',
        'M197.9 191.9 Q196.2 154.4 210.1 153.5 L506.8 156.1',
        'M440.5 100.3 Q442.2 88.1 454.4 88.1 L503.3 89.8 L503.3 114.2 L470.1 117.7 Q445.7 116.0 440.5 100.3 ZM470.1 88.1 V117.7 M503.3 91.5 H526.0 V112.5 H503.3',
        'M423.0 70.6 H431.7 V91.5 H423.0 ZM489.3 45.3 V81.1 H515.5 M515.5 129.9 H522.5 V136.9 H515.5 ZM538.2 135.2 H545.2 V142.1 H538.2 ZM400.3 133.4 H422.1 V143.0 H400.3 Z',
        'M242.4 191.9 V201.5 M266.8 191.9 V210.2 M498.1 191.9 V200.6 M503.3 187.5 H543.4 V198.0 H506.8',
        'M342.8 103.8 V93.3 H358.5 M249.4 100.3 V88.1 M285.2 102.0 V91.5 M139.5 97.7 L207.5 100.3 M327.0 192.8 V199.7 M388.1 192.8 V198.0'
      ],
      rotors: [{ hub: [130.7, 48.8], r: 300, blades: 3 }, { hub: [499.8, 34.8], r: 300, blades: 3, reverse: true }],
      circles: [[130.7,  48.8,  3.5],  [499.8,  34.8,  3.5],  [123.8,  120.3,  3.9],  [156.9,  136.9,  8.7],  [245.0,  136.9,  9.2],  [317.4,  139.5,  8.7],  [384.6,  142.1,  8.4],  [450.1,  143.9,  8.4],  [242.4,  201.5,  11.3],  [242.4,  201.5,  4.4],  [266.8,  210.2,  13.1],  [266.8,  210.2,  4.4],  [498.1,  200.6,  10.5],  [498.1,  200.6,  3.5],  [259.9,  129.1,  2.2]],
      faint: [
        'M179.6 112.5 L414.3 117.7 M218.9 109.0 V153.5 M279.9 110.7 V154.4 M345.4 112.5 V155.2 M410.8 114.2 V156.1 M201.4 171.8 L511.1 175.3 M98.5 178.8 L131.6 180.5 M437.0 74.1 L480.6 72.3 M86.2 102.0 L179.6 96.8 M96.7 67.1 V100.3 M102.8 67.1 V100.3',
        'M-200 223.3 L800 223.3'
      ]
    },
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

  // Liveries (looks). "neon" glows in the chosen accent colour; the rest set their own colours.
  // bg is a CSS background (it may include a grid); light = dark lines on a light ground (clock turns dark too).
  const rg = (a, b, c) => `radial-gradient(ellipse at 50% 45%, ${a} 0%, ${b} 62%, ${c || b} 100%)`;
  const LOOKS = {
    neon: { name: 'Neon glow on black', glow: true, width: 2.4 },
    dark: { name: 'White on black', glow: false, width: 2, bg: '#000000', stroke: '#f5f5f7', text: '#f5f5f7', light: false },
    light: { name: 'Black on white', glow: false, width: 2, bg: '#f5f5f7', stroke: '#1d1d1f', text: '#1d1d1f', light: true },
    paper: { name: 'Ink on paper', glow: false, width: 2.2, bg: rg('#fbf6ea', '#f1e8d4', '#e4d8bd'), stroke: '#22201c', text: '#2b2722', light: true },
    vanilla: { name: 'Espresso on vanilla', glow: false, width: 2.2, bg: rg('#fbefcf', '#f2e0b0', '#e6cf96'), stroke: '#3a2618', text: '#4a3020', light: true },
    sepia: { name: 'Sepia print', glow: false, width: 2.1, bg: rg('#eedcb6', '#dfc699', '#cdb07e'), stroke: '#4e3218', text: '#5a3a1c', light: true },
    graphite: { name: 'Graphite on stone', glow: false, width: 1.9, bg: rg('#ecebe7', '#dddbd5', '#cfccc4'), stroke: '#2f3033', text: '#3a3b3e', light: true },
    blueprint: { name: 'Blueprint', glow: false, width: 2, stroke: '#eef6ff', text: '#eef6ff', light: false,
      bg: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 44px 44px, linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 44px 44px, ' + rg('#2862ab', '#184782', '#0f3262') },
    chalk: { name: 'Chalk on slate', glow: false, width: 2.3, bg: rg('#38483f', '#26312b', '#1b231f'), stroke: '#efeee4', text: '#efeee4', light: false },
    gold: { name: 'Army black and gold', glow: true, width: 2.2, bg: rg('#1d1a12', '#0b0a08', '#040404'), stroke: '#d9b54a', text: '#ecd27e', light: false },
    od: { name: 'Olive drab', glow: false, width: 2.2, bg: rg('#4f5b37', '#323c22', '#252d19'), stroke: '#ebe1c1', text: '#ebe1c1', light: false },
    nvg: { name: 'Night vision', glow: true, width: 2.2, bg: rg('#0d3416', '#04140a', '#010603'), stroke: '#8dff8a', text: '#c9ffc4', light: false },
    warm: { name: 'Low light (warm, easy on the eyes at night)', glow: false, width: 2, bg: rg('#1d140c', '#0b0805', '#050302'), stroke: '#c8874a', text: '#d9a06a', light: false },
    auto: { name: 'Auto: ink on paper by day, low light at night' }
  };
  const ACCENTS = {
    blue: { name: 'Electric blue', stroke: '#5cc8ff', text: '#bfe8ff', tint: '#0b1d3a' },
    cyan: { name: 'Cyan', stroke: '#3ff0ff', text: '#c8fbff', tint: '#062a33' },
    violet: { name: 'Violet', stroke: '#b493ff', text: '#e2d6ff', tint: '#1c0f3a' },
    amber: { name: 'Amber', stroke: '#ffbe5c', text: '#ffe6bf', tint: '#2b1a06' },
    mint: { name: 'Mint', stroke: '#5cffb4', text: '#c9ffe6', tint: '#062a1d' },
    red: { name: 'Red', stroke: '#ff5c6c', text: '#ffd0d5', tint: '#2b0710' }
  };

  // Resolve the colours: a sketch's own livery wins over the default look; "auto" follows the time of day.
  function theme(look = {}, sk) {
    let style = sk && LOOKS[sk.livery] ? sk.livery : look.style;
    if (style === 'auto') { const h = new Date().getHours(); style = h >= 7 && h < 19 ? 'paper' : 'warm'; }
    const l = LOOKS[style] || LOOKS.neon;
    if (style !== 'neon' && l.stroke) return l;
    const a = ACCENTS[look.accent] || ACCENTS.blue;
    return { ...LOOKS.neon, stroke: a.stroke, text: a.text, light: false,
      bg: `radial-gradient(ellipse at 50% 55%, ${a.tint} 0%, #050b18 55%, #010206 100%)` };
  }

  const PATH_OK = /^[MLHVCSQTAZ0-9.,\s-]+$/;
  const safe = (arr) => (arr || []).filter((d) => typeof d === 'string' && PATH_OK.test(d));
  const num = (x) => typeof x === 'number' && isFinite(x);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cleanText = (t) => String(t || '').replace(/[^\p{L}\p{N} .,'!?&:-]/gu, '').trim().toUpperCase().slice(0, 24);

  // Motion styles shown in settings. "auto" picks per sketch (spinning rotors when it has them, else a gentle float).
  const SPEEDS = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };
  const SPEED_X = { slow: 1.7, normal: 1, fast: 0.55 };
  const MOTIONS = { auto: 'Auto (best for each sketch)', glow: 'Breathing glow', float: 'Gentle float', sweep: 'Light sweep', stars: 'Starfield', off: 'Off' };

  function rng0(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // Full-screen SVG (1920x1080 frame, scales to fill any screen).
  // sk = { subject, custom?, text? }; look = { style, accent, textPos, animate, motion }.
  function render(sk, look = {}, { thumb = false } = {}) {
    const base = sk.custom || SUBJECTS[sk.subject] || SUBJECTS.cybertruck;
    const subj = { ...base, paths: safe(base.paths), faint: safe(base.faint),
      circles: (base.circles || []).filter((c) => Array.isArray(c) && c.length === 3 && c.every(num)),
      rotors: (Array.isArray(base.rotors) ? base.rotors : []).filter((r) => r && Array.isArray(r.hub) && r.hub.length === 2 && r.hub.every(num) && num(r.r) && r.r > 2 && r.r < 900).slice(0, 4) };
    const size = Array.isArray(subj.size) && subj.size.every(num) ? subj.size : [600, 230];
    const st = theme(look, sk);
    const animate = look.animate !== false && !thumb;
    const [w, h] = size;
    const scale = ((thumb ? 1100 : 760) / w) * (num(subj.zoom) ? subj.zoom : 1);
    const x = 960 - (w / 2) * scale;
    const text = cleanText(sk.text);
    const below = look.textPos === 'below';
    const y = 600 - (h * scale) / 2 + (text ? (below ? -30 : 40) : 0);
    let i = 0;
    const count = subj.faint.length + subj.paths.length + subj.circles.length + subj.rotors.length;
    const step = Math.min(0.35, 3 / Math.max(1, count)); // detailed sketches still finish drawing in ~3-4 s
    const anim = () => (animate ? ` class="d" style="animation-delay:${(0.15 + step * i++).toFixed(2)}s"` : '');
    const drawn = animate ? 0.15 + step * count + 1.8 : 0;          // when the draw-in is finished
    // Per-sketch choices win over the default; Eco mode (look.still) and reduced-motion keep everything still.
    const pick = sk.motion && MOTIONS[sk.motion] ? sk.motion : look.motion;
    let motion = thumb || look.still || reducedMotion() ? 'off' : (MOTIONS[pick] ? pick : 'off');
    if (motion === 'auto') motion = subj.rotors.length ? 'rotors' : 'float';
    const sp = SPEED_X[sk.speed] || SPEED_X[look.speed] || 1;
    const spin = motion !== 'off' && subj.rotors.length > 0;
    // Rotors seen from the side: blades travel around a flat disc (an ellipse), so they sweep realistically.
    const SQ = 0.065, STEPS = 24;
    const rotors = subj.rotors.map((r, n) => {
      const R = r.r, nb = Math.min(Math.max(Math.round(r.blades || 2), 2), 6), dir = r.reverse ? -1 : 1;
      const dur = (1.5 * sp).toFixed(2) + 's', begin = (drawn + n * 0.17).toFixed(2) + 's';
      const pt = (a) => [(R * Math.cos(a)).toFixed(1), (R * SQ * Math.sin(a)).toFixed(1)];
      let blades = '';
      for (let b = 0; b < nb; b++) {
        const a0 = (b / nb) * Math.PI * 2 + 0.35;
        const [x2, y2] = pt(a0);
        let a = '';
        if (spin) {
          const xs = [], ys = [];
          for (let k = 0; k <= STEPS; k++) { const [px, py] = pt(a0 + dir * (k / STEPS) * Math.PI * 2); xs.push(px); ys.push(py); }
          a = `<animate attributeName="x2" values="${xs.join(';')}" dur="${dur}" begin="${begin}" repeatCount="indefinite"/><animate attributeName="y2" values="${ys.join(';')}" dur="${dur}" begin="${begin}" repeatCount="indefinite"/>`;
        }
        blades += `<line x1="0" y1="0" x2="${x2}" y2="${y2}">${a}</line>`;
      }
      const disc = spin ? `<ellipse cx="0" cy="0" rx="${R}" ry="${(R * SQ).toFixed(1)}" opacity=".22"/>` : '';
      return `<g transform="translate(${r.hub[0]} ${r.hub[1]})"${animate ? ` class="t" style="animation-delay:${(0.15 + step * i++).toFixed(2)}s"` : ''}>${disc}${blades}<circle cx="0" cy="0" r="${(R * 0.012 + 1.5).toFixed(1)}"/></g>`;
    }).join('');
    const strokes = [
      ...subj.faint.map((d) => `<path d="${d}" pathLength="1" opacity="${num(subj.weight) ? '.5' : '.28'}"${anim()}/>`),
      ...subj.paths.map((d) => `<path d="${d}" pathLength="1"${anim()}/>`),
      ...subj.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" pathLength="1"${anim()}/>`)
    ].join('') + rotors;
    const glowAnim = motion === 'glow' && st.glow
      ? `<animate attributeName="stdDeviation" values="5;10;5" dur="${(5 * sp).toFixed(1)}s" begin="${drawn.toFixed(2)}s" repeatCount="indefinite"/>` : '';
    const glow = st.glow
      ? `<filter id="g" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" result="b">${glowAnim}</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      : '';
    // Light sweep: a soft band of light that passes across the lines every few seconds.
    const sweepDefs = motion === 'sweep'
      ? `<linearGradient id="swg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="swm" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><rect x="-700" y="0" width="560" height="1080" fill="url(#swg)" transform="skewX(-18)"><animate attributeName="x" values="-700;-700;2500" keyTimes="0;.4;1" dur="${(6 * sp).toFixed(1)}s" begin="${drawn.toFixed(2)}s" repeatCount="indefinite"/></rect></mask>`
      : '';
    // Starfield: faint twinkling points, kept away from the drawing.
    let stars = '';
    if (motion === 'stars') {
      const r = rng0(([...(sk.subject || '') + (subj.name || '')].reduce((a2, c) => a2 * 31 + c.charCodeAt(0), 7)));
      for (let n = 0; n < 70; n++) {
        const sx = Math.round(r() * 1920), sy = Math.round(r() * 1080), rad = (0.8 + r() * 1.6).toFixed(1);
        if (sx > x - 60 && sx < x + w * scale + 60 && sy > y - 80 && sy < y + h * scale + 60) continue;
        const d = ((2.5 + r() * 4) * sp).toFixed(1), b = (drawn + r() * 4).toFixed(1);
        stars += `<circle cx="${sx}" cy="${sy}" r="${rad}" fill="${st.text}" opacity=".15"><animate attributeName="opacity" values=".1;.75;.1" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></circle>`;
      }
    }
    const css = `<style>${animate ? `.d{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.8s cubic-bezier(.6,.05,.3,1) forwards}
         .t{opacity:0;animation:fade 1.6s ease forwards;animation-delay:${(0.4 + step * i).toFixed(2)}s}
         @keyframes draw{to{stroke-dashoffset:0}}@keyframes fade{to{opacity:1}}` : ''}
         ${motion === 'float' ? `.fl{animation:fl ${(7 * sp).toFixed(1)}s ease-in-out ${drawn.toFixed(2)}s infinite}@keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}` : ''}
         @media (prefers-reduced-motion: reduce){.d,.t,.fl{animation:none;stroke-dashoffset:0;opacity:1;transform:none}}</style>`;
    const ty = below ? Math.round(y + h * scale + 120) : Math.round(y - 70);
    const word = text
      ? `<text x="960" y="${ty}" text-anchor="middle" class="${animate ? 't' : ''}" fill="${st.text}"
           font-family="'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="300" font-size="${thumb ? 64 : 44}"
           letter-spacing="26" ${st.glow ? 'filter="url(#g)"' : ''}>${esc(text)}</text>`
      : '';
    const gAttrs = `transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="none" stroke="${st.stroke}"
         stroke-width="${((thumb ? st.width * 2.6 : st.width) * (num(subj.weight) ? subj.weight : 1) / scale).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"`;
    const sweepLayer = motion === 'sweep'
      ? `<g mask="url(#swm)"><g ${gAttrs.replace(`stroke="${st.stroke}"`, `stroke="${st.light ? '#000000' : '#ffffff'}"`).replace(/stroke-width="([\d.]+)"/, (m, v) => `stroke-width="${(v * 1.6).toFixed(3)}"`)} opacity="${st.light ? '.55' : '1'}" ${st.glow ? 'filter="url(#g)"' : ''}>${strokes.replace(/ class="d" style="[^"]*"/g, '')}</g></g>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <defs>${glow}${sweepDefs}</defs>${css}${stars}
      <g class="fl"><g ${gAttrs}
         ${st.glow ? 'filter="url(#g)"' : ''}>${strokes}</g>${sweepLayer}</g>
      ${word}</svg>`;
  }

  const background = (look, sk) => theme(look, sk).bg;
  const isLight = (look, sk) => !!theme(look, sk).light;

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

  return { MOTIONS, SPEEDS, SUBJECTS, LOOKS, ACCENTS, GENERATORS, render, background, isLight, generate, cleanText };
})();
