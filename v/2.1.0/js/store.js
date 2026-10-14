// Images, settings, rotation and Bing photo search for Backdrop Rotator.
const APP_VERSION = '2.1.0';

const BR = (() => {
  // ---------- Storage (lives in the extension, reached through the bridge) ----------
  const db = (ops) => Bridge.call('idb', { store: 'images', ops });
  const first = (p) => p.then((r) => r[0]);

  const addImages = (files) =>
    db(files.map((f) => ({ method: 'add', args: [{ name: f.name, type: f.type, blob: f, added: Date.now(), source: 'upload' }] })));
  const addRecords = (recs) => (recs.length ? db(recs.map((r) => ({ method: 'add', args: [r] }))) : Promise.resolve([]));
  const putImage = (rec) => db([{ method: 'put', args: [rec] }]);
  const getIds = () => first(db([{ method: 'getAllKeys' }]));
  const getImage = (id) => first(db([{ method: 'get', args: [id] }]));
  const getAll = () => first(db([{ method: 'getAll' }]));
  const deleteImage = (id) => db([{ method: 'delete', args: [id] }]);
  const deleteMany = (ids) => (ids.length ? db(ids.map((id) => ({ method: 'delete', args: [id] }))) : Promise.resolve());
  const clearAll = () => db([{ method: 'clear' }]);

  const DEFAULTS = {
    mode: 'newtab',        // 'newtab' | 'interval' | 'daily'
    intervalMin: 30,
    order: 'shuffle',      // 'shuffle' | 'sequence'
    clock: true,
    clock24: false,
    search: true,
    dim: 15,
    showCredit: true,
    themes: [],            // auto-rotating searches: [{ name, key, lastFetched }]
    perTheme: 50,
    autoRefresh: 'daily',  // 'daily' | 'weekly' | 'off'
    seen: {},
    refreshLock: 0,
    currentId: null,
    lastChange: 0,
    deck: [],
    // AI
    aiEngine: 'free',      // 'free' | 'openai'
    openaiKey: '',
    openaiModel: 'gpt-image-2',
    openaiQuality: 'high',
    aiStyle: 'cinematic',
    aiFont: 'Bebas Neue',
    aiTextPos: 'center',
    aiTextMode: 'ai',      // 'ai' (model draws it, OpenAI only) | 'overlay'
    // Eco mode
    eco: false,
    aiDay: { d: '', n: 0 }  // AI images made today (for the Eco daily limit)
  };

  const ECO = { aiPerDay: 5, maxPerSearch: 50, freeSize: [768, 432], openaiQuality: 'low' };

  const getSettings = () => Bridge.call('storage.get', DEFAULTS);
  const saveSettings = (patch) => Bridge.call('storage.set', patch);

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

  // ---------- Web requests (through the extension, so any site works) ----------
  const webFetch = (url, opts = {}) => Bridge.call('fetch', { url, ...opts });

  const themeKey = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');
  const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'", '#x27': "'", apos: "'" };
  const decode = (s) => s.replace(/&(quot|amp|lt|gt|#39|#x27|apos);/g, (m, e) => ENT[e]);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  // Bing Images, strictest (wallpaper-size, widescreen) first, loosening for niche searches.
  const FILTERS = [
    '+filterui:imagesize-wallpaper+filterui:aspect-wide',
    '+filterui:imagesize-large+filterui:aspect-wide',
    '+filterui:imagesize-large',
    ''
  ];

  async function bingPage(q, start, filter, purpose) {
    const url = 'https://www.bing.com/images/async?q=' + encodeURIComponent(q) +
      `&first=${start}&count=35&adlt=moderate&mmasync=1` + (filter ? '&qft=' + filter : '');
    const r = await webFetch(url, { timeout: 20000, purpose }).catch((e) => {
      if (/^Blocked:|stopped/.test(e.message)) throw e;
      throw new Error("Couldn't reach Bing. Check your internet connection.");
    });
    if (!r.ok) throw new Error(`Image search failed (error ${r.status}). Try again in a minute.`);
    const out = [];
    for (const m of r.body.matchAll(/\bm="(\{[^"]*?\})"/g)) {
      try {
        const j = JSON.parse(decode(m[1]));
        if (j.murl && /^https?:\/\//.test(j.murl))
          out.push({ key: j.md5 || j.murl, full: j.murl, thumb: j.turl || j.murl,
                     page: /^https?:\/\//.test(j.purl || '') ? j.purl : '', title: j.t || '' });
      } catch (e) { /* skip malformed entry */ }
    }
    return out;
  }

  async function searchImages(q, start = 0, level = null, purpose) {
    if (level != null) return { results: await bingPage(q, start, FILTERS[level], purpose), level };
    for (let i = 0; i < FILTERS.length; i++) {
      const results = await bingPage(q, start, FILTERS[i], purpose);
      if (results.length >= 12 || i === FILTERS.length - 1) return { results, level: i };
    }
  }

  async function download(c, { minWidth = 600, landscape = false, purpose } = {}) {
    try {
      const r = await webFetch(c.full, { responseType: 'blob', timeout: 25000, purpose });
      const blob = r.body;
      if (!r.ok || !blob || !blob.type.startsWith('image/') || blob.size < 20000 || blob.size > 30e6) return null;
      const bmp = await createImageBitmap(blob);
      const { width, height } = bmp;
      bmp.close();
      if (width < minWidth || (landscape && width < height)) return null;
      return {
        name: c.title || host(c.page) || 'Web photo', type: blob.type, blob, added: Date.now(),
        source: 'web', srcKey: c.key,
        credit: { title: c.title, site: host(c.page) || host(c.full), link: c.page }
      };
    } catch (e) {
      if (/^Blocked:|stopped/.test(e.message)) throw e; // access turned off: stop the whole run
      return null;
    }
  }

  // Run fn over items with n at a time.
  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }));
  }

  async function addPicked(cands, onProgress) {
    let blockErr = null;
    const recs = [];
    let failed = 0, done = 0;
    await pool(cands, 4, async (c) => {
      const rec = await download(c).catch((e) => { blockErr = e; return null; });
      if (rec) { rec.keep = true; recs.push(rec); } else failed++;
      if (onProgress) onProgress(++done, cands.length);
    });
    await addRecords(recs);
    if (blockErr && !recs.length) throw blockErr;
    return { added: recs.length, failed };
  }

  async function addFromUrl(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error("That doesn't look like an image link (it should start with https://).");
    const rec = await download({ key: url, full: url, page: url, title: '' }, { minWidth: 1 });
    if (!rec) throw new Error("Couldn't download an image from that link. Right-click the image > Copy image link, and paste that.");
    rec.keep = true;
    await addRecords([rec]);
  }

  // Fill an auto-rotating search with up to perTheme photos (paging through Bing as far as it goes).
  async function fetchTheme(name, { replace = false, onProgress, auto = false } = {}) {
    name = name.trim();
    const key = themeKey(name);
    const s = await getSettings();
    const purpose = auto ? 'auto' : 'user';
    const want = s.eco ? Math.min(s.perTheme, ECO.maxPerSearch) : s.perTheme;
    let seen = new Set(s.seen[key] || []);
    let oldIds = [];
    if (replace) {
      const all = await getAll();
      oldIds = all.filter((r) => r.source === 'web' && r.theme === key && !r.keep).map((r) => r.id);
    }

    let got = 0, level = null, emptyPages = 0;
    const tried = new Set(), newKeys = [];
    const maxPages = Math.ceil(want / 20) + 8;
    for (let page = 0; page < maxPages && got < want; page++) {
      const res = await searchImages(name, page * 35, level, purpose);
      level = res.level;
      if (!res.results.length) break;
      let fresh = res.results.filter((c) => !seen.has(c.key) && !tried.has(c.key));
      if (page === 0 && !fresh.length && seen.size) { seen = new Set(); fresh = res.results; } // seen it all: start over
      if (!fresh.length) { if (++emptyPages >= 3) break; continue; }
      emptyPages = 0;
      fresh.forEach((c) => tried.add(c.key));
      const batch = [];
      await pool(fresh, 6, async (c) => {
        if (got + batch.length >= want) return;
        const rec = await download(c, { minWidth: 1280, landscape: true, purpose });
        if (rec && got + batch.length < want) { rec.theme = key; batch.push(rec); }
      });
      await addRecords(batch); // save as we go, so a closed tab keeps what it got
      got += batch.length;
      batch.forEach((r) => newKeys.push(r.srcKey));
      if (onProgress) onProgress(got, want);
    }
    if (!got) throw new Error(`Couldn't find downloadable photos for "${name}". Try different wording.`);
    await deleteMany(oldIds);

    const now = await getSettings();
    const existing = now.themes.find((t) => t.key === key);
    const themes = now.themes.filter((t) => t.key !== key);
    themes.push({ name: existing ? existing.name : name, key, lastFetched: Date.now() });
    themes.sort((a, b) => a.name.localeCompare(b.name));
    const seenAll = { ...now.seen, [key]: [...seen, ...newKeys].slice(-3000) };
    await saveSettings({ themes, seen: seenAll });
    return got;
  }

  async function removeTheme(key) {
    const all = await getAll();
    await deleteMany(all.filter((r) => r.source === 'web' && r.theme === key && !r.keep).map((r) => r.id));
    const s = await getSettings();
    const seen = { ...s.seen };
    delete seen[key];
    await saveSettings({ themes: s.themes.filter((t) => t.key !== key), seen });
  }

  // Called from new tabs: refresh any auto-rotating search that's due (one tab at a time).
  const PERIOD = { daily: 24 * 3600e3, weekly: 7 * 24 * 3600e3 };
  async function onBattery() {
    try { const b = navigator.getBattery && await navigator.getBattery(); return !!(b && !b.charging); } catch (e) { return false; }
  }

  async function refreshDueThemes() {
    const s = await getSettings();
    const info = await Bridge.call('info').catch(() => ({ perms: {} }));
    if (info.perms && info.perms.autoRefresh === false) return; // turned off in the Control Center
    // Eco: at most weekly, and only while plugged in.
    const period = s.eco && s.autoRefresh !== 'off' ? PERIOD.weekly : PERIOD[s.autoRefresh];
    if (!period || !s.themes.length) return;
    if (s.eco && await onBattery()) return;
    const due = s.themes.filter((t) => Date.now() - (t.lastFetched || 0) >= period);
    if (!due.length || Date.now() - s.refreshLock < 10 * 60000) return;
    await saveSettings({ refreshLock: Date.now() });
    for (const t of due) {
      try { await fetchTheme(t.name, { replace: true, auto: true }); }
      catch (e) { console.warn('Refresh failed for', t.name, e); if (/^Blocked:|stopped/.test(e.message)) break; }
    }
    await saveSettings({ refreshLock: 0 });
  }

  return {
    addImages, addRecords, putImage, getIds, getImage, getAll, deleteImage, deleteMany, clearAll,
    DEFAULTS, ECO, getSettings, saveSettings, isDue, msUntilNext, advance, webFetch,
    themeKey, searchImages, addPicked, addFromUrl, fetchTheme, removeTheme, refreshDueThemes
  };
})();
