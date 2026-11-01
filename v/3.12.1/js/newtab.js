if (!Bridge.inShell) showNotInShell();
else (() => {
  const layers = [document.getElementById('bgA'), document.getElementById('bgB')];
  const timeEl = document.getElementById('time');
  const dateEl = document.getElementById('date');
  const cdEl = document.getElementById('countdown');
  let front = 0, shownKey = null, timer = null, announced = false;
  let settings = { ...BR.DEFAULTS };

  const announce = () => { if (!announced) { announced = true; Bridge.ready(); } };
  const lookKey = (s) => [s.sketchStyle, s.accent, s.textPos, s.animate, s.motion, s.motionSpeed, s.eco, s.editStamp].join('|');

  let shownSketch = null;
  const history = [];   // sketches shown in this tab, for "previous"
  // Crossfade to a sketch.
  async function show(id, force = false) {
    const key = id + '|' + lookKey(settings);
    if (!force && key === shownKey) return true;
    const rec = await BR.getImage(id);
    if (!BR.isSketch(rec)) return false;
    const look = BR.look(settings);
    const back = layers[1 - front];
    back.style.background = Sketch.background(look, rec.sketch);
    back.innerHTML = Sketch.render(rec.sketch, look);
    // The clock, date and page edge follow the livery of the sketch on screen.
    shownSketch = rec.sketch;
    if (history[history.length - 1] !== id) { history.push(id); if (history.length > 50) history.shift(); }
    document.body.classList.toggle('light', Sketch.isLight(look, rec.sketch));
    document.documentElement.style.background = Sketch.background(look, rec.sketch);
    hudColors(settings); hudStatus();
    back.classList.add('visible');
    layers[front].classList.remove('visible');
    front = 1 - front; shownKey = key;
    return true;
  }

  function applyUI(s) {
    const b = document.body;
    ['corner', 'top', 'center', 'hidden'].forEach((c) => b.classList.toggle('clock-' + c, s.clockStyle === c));
    b.classList.toggle('light', Sketch.isLight(BR.look(s), shownSketch));
    document.getElementById('search').classList.toggle('off', !s.search);
    dateEl.classList.toggle('off', !s.showDate);
    document.documentElement.style.background = Sketch.background(BR.look(s), shownSketch);
    b.classList.toggle('zen', !!s.zen);
    b.classList.toggle('hud', s.hud !== false);
    b.classList.remove('booting');
    hudColors(s); renderLaunch(s); hudStatus();
    tickClock();
  }

  // "34 DAYS TO ARMY-NAVY" (hidden when unset or past).
  function countdownText(s, now) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.countdownDate || ''); const name = String(s.countdownName || '').trim();
    if (!m || !name) return '';
    const day = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    const n = day(new Date(+m[1], +m[2] - 1, +m[3])) - day(now);
    if (n < 0) return '';
    return n === 0 ? name + ' is today' : n === 1 ? '1 day to ' + name : n + ' days to ' + name;
  }

  function tickClock() {
    const s = settings, now = new Date();
    const opts = s.clock24 ? { hour: '2-digit', minute: '2-digit', hour12: false } : { hour: 'numeric', minute: '2-digit' };
    if (s.showSeconds) opts.second = '2-digit';
    timeEl.textContent = now.toLocaleTimeString([], opts);
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const cd = countdownText(s, now); cdEl.textContent = cd; cdEl.classList.toggle('off', !cd);
    hudTick(now);
  }

  function schedule() {
    clearTimeout(timer);
    const ms = BR.msUntilNext(settings);
    if (ms != null) timer = setTimeout(refresh, Math.min(ms, 2 ** 31 - 1));
  }

  async function refresh(force = false) {
    const [ids, s] = await Promise.all([BR.getSketchIds(), BR.getSettings()]);
    settings = s;
    applyUI(s);
    document.body.classList.toggle('empty', !ids.length);
    if (!ids.length) { clearTimeout(timer); announce(); return; }
    if (force || BR.isDue(s, ids)) await BR.advance(ids, s);
    for (let tries = 0; tries < Math.min(5, ids.length); tries++) {
      if (await show(s.currentId)) break;
      await BR.advance(ids, s);
    }
    announce();
    schedule();
  }


  // ---------- HUD: the whole screen as a heads-up display, in the colours of the sketch on screen ----------
  const hudTop = document.getElementById('hudTop'), hudBottom = document.getElementById('hudBottom');
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function hudColors(s) {
    const t = Sketch.theme(BR.look(s), shownSketch) || {};
    const r = document.documentElement.style;
    r.setProperty('--hud', t.stroke || '#5cc8ff'); r.setProperty('--hudtext', t.text || t.stroke || '#d8f7ff');
  }
  function hudTick(now) {
    if (!settings.hud) return;
    const start = new Date(now.getFullYear(), 0, 1), doy = Math.floor((now - start) / 864e5) + 1;
    const th = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); th.setUTCDate(th.getUTCDate() + 4 - (th.getUTCDay() || 7));
    const wk = Math.ceil(((th - Date.UTC(th.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
    hudTop.textContent = `DAY ${pad(doy, 3)}  ·  WK ${pad(wk)}  ·  ${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}Z`;
  }
  function hudStatus() {
    const sk = shownSketch, name = sk ? ((sk.custom && sk.custom.name) || (Sketch.SUBJECTS[sk.subject] || {}).name || 'Sketch') : 'No sketch';
    const lv = (Sketch.LOOKS[(sk && sk.livery) || settings.sketchStyle] || {}).name || '';
    hudBottom.textContent = (settings.zen ? `Focus view on  ·  press F to show the clock and search` : `${name}  ·  ${lv.split(/[(:]/)[0].trim()}  ·  ${links.length} app${links.length === 1 ? '' : 's'}  ·  ? help`).toUpperCase();
  }

  // ---------- Quick launch: the APPS dial fans your sites out in two arcs ----------
  const launchEl = document.getElementById('launch'), ringEl = document.getElementById('launchRing'), launchBtn = document.getElementById('launchBtn');
  const panel = document.getElementById('appPanel'), apIn = document.getElementById('apIn'), apMsg = document.getElementById('apMsg');
  let launchKey = '', links = [];
  const FRAME = '<svg class="frame" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 2 L43 13 V35 L24 46 L5 35 V13 Z"/></svg>';
  function place(el, i, n) {   // arcs of 4, 5 and 4 tiles, from straight up round to the right, so labels never crowd
    const caps = [4, 5, 4], radii = [170, 275, 380];
    let a = 0, k = i; while (a < 2 && k >= caps[a]) { k -= caps[a]; a++; }
    const m = Math.min(caps[a], n - caps.slice(0, a).reduce((x, y) => x + y, 0)), R = radii[a];
    const t = m === 1 ? 0.5 : k / (m - 1), ang = (-90 + 90 * t) * Math.PI / 180;
    el.style.setProperty('--x', Math.round(Math.cos(ang) * R) + 'px'); el.style.setProperty('--y', Math.round(Math.sin(ang) * R) + 'px');
    el.style.setProperty('--d', (i * 35) + 'ms');
  }
  function renderLaunch(s) {
    links = s.launch === false ? [] : Launch.clean(s.quickLinks);
    launchEl.classList.toggle('off', s.launch === false);
    document.getElementById('launchCount').textContent = links.length;
    const key = JSON.stringify(links);
    if (key === launchKey) return;
    launchKey = key; ringEl.replaceChildren();
    const n = links.length + 1;
    links.forEach((l, i) => {
      const a = document.createElement('a');
      a.className = 'node'; a.href = l.url; a.target = '_top'; a.rel = 'noreferrer'; a.setAttribute('role', 'menuitem');
      a.title = i < 9 ? `${l.name} (${i + 1})` : l.name;
      a.innerHTML = `<span class="tile">${FRAME}${Launch.svg(Launch.iconFor(l), 20)}${i < 9 ? `<b>${i + 1}</b>` : ''}</span><span class="lbl"></span>`;
      a.querySelector('.lbl').textContent = l.name;
      a.addEventListener('click', () => setLaunch(false));
      place(a, i, n); ringEl.append(a);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'node add'; add.title = 'Add or edit apps (A)';
    add.innerHTML = `<span class="tile">${FRAME}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span class="lbl">${links.length ? 'Add / edit' : 'Add apps'}</span>`;
    add.addEventListener('click', (e) => { e.stopPropagation(); openPanel(); });
    place(add, links.length, n); ringEl.append(add);
    if (!panel.hidden) renderPanel();
    hudStatus();
  }
  function setLaunch(open) {
    launchEl.classList.toggle('open', open);
    launchBtn.setAttribute('aria-expanded', String(open));
  }
  launchBtn.addEventListener('click', (e) => { e.stopPropagation(); setLaunch(!launchEl.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!launchEl.contains(e.target) && !panel.contains(e.target)) setLaunch(false); });

  // ---------- Add apps right here: paste a link, type a name, or tap a quick pick ----------
  async function saveLinks(list, msg) {
    const clean = Launch.clean(list);
    settings.quickLinks = clean; await BR.saveSettings({ quickLinks: clean });
    renderLaunch(settings); renderPanel(); if (msg) say(msg);
  }
  let sayT = null;
  function say(t, bad) { apMsg.textContent = t; apMsg.classList.toggle('bad', !!bad); clearTimeout(sayT); sayT = setTimeout(() => { apMsg.textContent = ''; }, 4000); }
  function addLink(l) {
    if (!l) { say('Paste a link like https://… or type a name such as canvas or youtube.', true); return false; }
    if (links.length >= Launch.MAX) { say(`The launcher holds ${Launch.MAX} apps. Remove one first.`, true); return false; }
    if (links.some((x) => x.url === l.url)) { say(`${l.name} is already loaded.`, true); return false; }
    saveLinks([...links, l], `${l.name} added. It's in slot ${links.length + 1}.`); return true;
  }
  let glyphFor = -1;
  function renderPanel() {
    const pre = document.getElementById('apPresets'); pre.replaceChildren();
    for (const p of Launch.PRESETS) {
      if (links.some((x) => Launch.hostOf(x.url) === Launch.hostOf(p.url) && x.url.replace(/\/$/, '') === p.url.replace(/\/$/, ''))) continue;
      const b = document.createElement('button'); b.type = 'button'; b.innerHTML = Launch.svg(p.icon, 15) + '<span></span>'; b.querySelector('span').textContent = p.name;
      b.addEventListener('click', () => addLink({ ...p })); pre.append(b);
    }
    document.getElementById('apCount').textContent = `${links.length}/${Launch.MAX}`;
    const ol = document.getElementById('apList'); ol.replaceChildren();
    links.forEach((l, i) => {
      const li = document.createElement('li');
      const ic = document.createElement('button'); ic.type = 'button'; ic.className = 'ic'; ic.title = 'Change symbol'; ic.innerHTML = Launch.svg(Launch.iconFor(l), 18);
      ic.addEventListener('click', () => { glyphFor = glyphFor === i ? -1 : i; renderPanel(); });
      const nm = document.createElement('input'); nm.value = l.name; nm.maxLength = 20; nm.setAttribute('aria-label', 'Name');
      nm.addEventListener('change', () => { const v = nm.value.trim(); if (v) saveLinks(links.map((x, k) => (k === i ? { ...x, name: v } : x))); });
      const host = document.createElement('small'); host.textContent = Launch.hostOf(l.url);
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.title = 'Move up'; up.disabled = i === 0;
      up.addEventListener('click', () => { const c = links.slice(); [c[i - 1], c[i]] = [c[i], c[i - 1]]; saveLinks(c); });
      const del = document.createElement('button'); del.type = 'button'; del.textContent = '✕'; del.title = 'Remove'; del.className = 'del';
      del.addEventListener('click', () => saveLinks(links.filter((_, k) => k !== i), `${l.name} removed.`));
      const num = document.createElement('b'); num.textContent = pad(i + 1);
      li.append(num, ic, nm, host, up, del);
      if (glyphFor === i) {
        const g = document.createElement('div'); g.className = 'glyphs';
        for (const k of ['auto', ...Object.keys(Launch.GLYPHS)]) {
          const b = document.createElement('button'); b.type = 'button'; b.title = k === 'auto' ? 'Automatic' : Launch.GLYPHS[k][0];
          b.innerHTML = k === 'auto' ? 'AUTO' : Launch.svg(k, 18); b.setAttribute('aria-pressed', String((l.icon || 'auto') === k));
          b.addEventListener('click', () => { glyphFor = -1; saveLinks(links.map((x, n) => (n === i ? { ...x, icon: k } : x))); });
          g.append(b);
        }
        li.append(g);
      }
      ol.append(li);
    });
  }
  function openPanel() { setLaunch(false); glyphFor = -1; renderPanel(); panel.hidden = false; setTimeout(() => apIn.focus(), 30); }
  function closePanel() { panel.hidden = true; }
  document.getElementById('apClose').addEventListener('click', closePanel);
  document.getElementById('apForm').addEventListener('submit', (e) => { e.preventDefault(); if (addLink(Launch.parse(apIn.value))) apIn.value = ''; });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePanel(); } });

  // Settings changes show up right away on open tabs.
  Bridge.onStorage(async (c) => {
    if ('studioInbox' in c) { ClaudeSketch.drainInbox().catch(() => 0); return; }
    settings = await BR.getSettings();
    applyUI(settings);
    if (['sketchStyle', 'accent', 'textPos', 'animate', 'motion', 'motionSpeed', 'eco', 'editStamp'].some((k) => k in c) && settings.currentId != null) {
      await show(settings.currentId, true);
    }
    if ('mode' in c || 'intervalMin' in c) schedule();
    if ('currentId' in c && settings.mode !== 'newtab' && settings.currentId != null) { await show(settings.currentId); schedule(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && settings.mode !== 'newtab') refresh();
  });

  document.getElementById('nextBtn').addEventListener('click', (e) => {
    const b = e.currentTarget;
    b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
    refresh(true);
  });
  document.getElementById('settingsBtn').addEventListener('click', () => Bridge.call('openSettings'));
  document.getElementById('addBtn').addEventListener('click', () => Bridge.call('openSettings'));
  document.getElementById('search').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('q').value.trim();
    if (text) Bridge.call('search', { text });
  });

  // ---------- Keyboard shortcuts ----------
  const toastEl = document.getElementById('toast'), helpEl = document.getElementById('help');
  let toastT = null;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1600); }
  async function stepLivery(dir) {
    const keys = Object.keys(Sketch.LOOKS), i = keys.indexOf(settings.sketchStyle), next = keys[(i + dir + keys.length) % keys.length];
    if (shownSketch && shownSketch.livery) toast('This sketch has its own livery (change it with ⚙ in Settings)');
    else toast(Sketch.LOOKS[next].name);
    settings.sketchStyle = next; await BR.saveSettings({ sketchStyle: next });
  }
  async function showPrevious() {
    if (history.length < 2) { toast('No earlier sketch in this tab'); return; }
    history.pop(); const id = history.pop();
    await BR.saveSettings({ currentId: id, lastChange: Date.now() }); settings.currentId = id; await show(id, true);
  }
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key;
    if (launchEl.classList.contains('open') && /^[1-9]$/.test(k)) {
      const l = links[+k - 1]; if (l) { e.preventDefault(); setLaunch(false); window.top.location.href = l.url; } return;
    }
    if (k === 'g' || k === 'G') { if (settings.launch !== false) setLaunch(!launchEl.classList.contains('open')); return; }
    if ((k === 'a' || k === 'A' || k === '+') && settings.launch !== false) { e.preventDefault(); openPanel(); return; }
    if (k === 'h' || k === 'H') { const h = settings.hud === false; settings.hud = h; document.body.classList.toggle('hud', h); toast(h ? 'HUD on' : 'HUD off (H to turn it back on)'); BR.saveSettings({ hud: h }); return; }
    if (k === 'Escape') { setLaunch(false); closePanel(); }
    if (k === 'n' || k === 'N' || k === 'ArrowRight') { e.preventDefault(); refresh(true); }
    else if (k === 'p' || k === 'P' || k === 'ArrowLeft') { e.preventDefault(); showPrevious(); }
    else if (k === 'l') stepLivery(1);
    else if (k === 'L') stepLivery(-1);
    else if (k === 'f' || k === 'F') { const z = !settings.zen; settings.zen = z; document.body.classList.toggle('zen', z); toast(z ? 'Focus view on (F to turn off)' : 'Focus view off'); hudStatus(); BR.saveSettings({ zen: z }); }
    else if (k === '/') { e.preventDefault(); if (settings.search) document.getElementById('q').focus(); }
    else if (k === '?') helpEl.hidden = !helpEl.hidden;
    else if (k === 'Escape') helpEl.hidden = true;
  });

  setInterval(tickClock, 1000);
  BR.migrate().catch(() => 0)
    .then(() => ClaudeSketch.drainInbox().catch(() => 0))
    .then(() => refresh())
    .catch((e) => { console.error(e); document.body.classList.remove('booting'); announce(); });
})();
