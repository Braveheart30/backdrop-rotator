// Library, settings and rotation for Backdrop Rotator (sketch-only edition).
// Nothing here downloads images from the web: every background is a line drawing stored as a few numbers.
const APP_VERSION = '3.11.0';

const BR = (() => {
  // ---------- Storage (lives in the extension, reached through the bridge) ----------
  const db = (ops) => Bridge.call('idb', { store: 'images', ops });
  const first = (p) => p.then((r) => r[0]);

  const addRecords = (recs) => (recs.length ? db(recs.map((r) => ({ method: 'add', args: [r] }))) : Promise.resolve([]));
  const putImage = (rec) => db([{ method: 'put', args: [rec] }]);
  const getImage = (id) => first(db([{ method: 'get', args: [id] }]));
  const getAll = () => first(db([{ method: 'getAll' }]));
  const deleteImage = (id) => db([{ method: 'delete', args: [id] }]);
  const deleteMany = (ids) => (ids.length ? db(ids.map((id) => ({ method: 'delete', args: [id] }))) : Promise.resolve());

  const isSketch = (r) => r && r.source === 'sketch' && r.sketch;
  // One-time: the Chinook goes without a word (as asked).
  async function migrate() {
    const s = await getSettings();
    if (s.migChinookWord) return;
    const all = await getAll();
    for (const r of all) if (isSketch(r) && r.sketch.subject === 'chinook' && r.sketch.text) { r.sketch.text = ''; await putImage(r); }
    await saveSettings({ migChinookWord: true });
  }
  const getSketches = async () => (await getAll()).filter(isSketch);
  const getSketchIds = async () => (await getSketches()).map((r) => r.id);
  // Older versions saved photos; they're kept until you delete them, but never shown.
  const legacyIds = async () => (await getAll()).filter((r) => !isSketch(r)).map((r) => r.id);

  const DEFAULTS = {
    // Look (shared by every sketch so everything stays on theme)
    sketchStyle: 'neon',   // a livery from Sketch.LOOKS (neon, paper, blueprint, gold, auto...)
    accent: 'blue',        // neon color
    textPos: 'above',      // 'above' | 'below'
    animate: true,         // draw-in animation
    motion: 'auto',        // ambient motion after drawing (see Sketch.MOTIONS)
    motionSpeed: 'normal', // slow | normal | fast
    migChinookWord: false,
    editStamp: 0,          // bumped when a sketch's own settings change, so open tabs redraw it
    sketchText: '',        // default word for new sketches
    customSketches: [],    // drawings made by Claude or "Surprise me", reusable in the picker
    // New tab
    clockStyle: 'corner',  // 'corner' | 'top' | 'center' | 'hidden'
    clock24: false,
    showDate: true,
    showSeconds: false,
    search: true,
    countdownName: '',     // e.g. ARMY-NAVY; shown as "34 DAYS TO ARMY-NAVY" under the clock
    countdownDate: '',     // YYYY-MM-DD
    zen: false,            // Focus view: only the sketch (press F on the new tab)
    launch: true,          // quick-launch emblem (bottom-left; G on the new tab)
    quickLinks: [
      { name: 'Notion', url: 'https://www.notion.so', icon: 'auto' },
      { name: 'Calendar', url: 'https://calendar.notion.so', icon: 'auto' },
      { name: 'Todoist', url: 'https://app.todoist.com', icon: 'auto' },
      { name: 'Claude', url: 'https://claude.ai', icon: 'auto' }
    ],
    // Rotation
    mode: 'newtab',        // 'newtab' | 'interval' | 'daily'
    intervalMin: 30,
    order: 'shuffle',      // 'shuffle' | 'sequence'
    currentId: null,
    lastChange: 0,
    deck: [],
    // Claude
    claudeKey: '',
    claudeModel: 'claude-sonnet-5-5',
    // Eco mode
    eco: false,
    aiDay: { d: '', n: 0 }
  };

  const ECO = { aiPerDay: 5 };

  const getSettings = () => Bridge.call('storage.get', DEFAULTS);
  const saveSettings = (patch) => Bridge.call('storage.set', patch);
  const look = (s) => ({ style: s.sketchStyle, accent: s.accent, textPos: s.textPos, animate: s.animate, motion: s.motion || 'auto', speed: s.motionSpeed || 'normal', still: !!s.eco });

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Rotation ----------
  function isDue(s, ids) {
    if (!ids.includes(s.currentId)) return true;
    if (s.mode === 'newtab') return true;
    if (s.mode === 'daily') return new Date(s.lastChange).toDateString() !== new Date().toDateString();
    return Date.now() - s.lastChange >= s.intervalMin * 60000;
  }

  function msUntilNext(s) {
    if (s.mode === 'interval') return Math.max(1000, s.lastChange + s.intervalMin * 60000 - Date.now());
    if (s.mode === 'daily') { const d = new Date(); d.setHours(24, 0, 0, 0); return d - Date.now() + 1000; }
    return null;
  }

  async function advance(ids, s) {
    if (!ids.length) return null;
    let next;
    if (ids.length === 1) next = ids[0];
    else if (s.order === 'sequence') next = ids[(ids.indexOf(s.currentId) + 1) % ids.length];
    else {
      let deck = (s.deck || []).filter((id) => ids.includes(id) && id !== s.currentId);
      if (!deck.length) deck = shuffle(ids.filter((id) => id !== s.currentId));
      next = deck.pop();
      s.deck = deck;
    }
    s.currentId = next;
    s.lastChange = Date.now();
    await saveSettings({ currentId: next, lastChange: s.lastChange, deck: s.deck || [] });
    return next;
  }

  // Only used to talk to Claude (api.anthropic.com), through the extension's access controls.
  const webFetch = (url, opts = {}) => Bridge.call('fetch', { url, ...opts });

  return {
    addRecords, putImage, getImage, getAll, deleteImage, deleteMany, getSketches, getSketchIds, legacyIds, isSketch,
    migrate, DEFAULTS, ECO, getSettings, saveSettings, look, isDue, msUntilNext, advance, webFetch
  };
})();
