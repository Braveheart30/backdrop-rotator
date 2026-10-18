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
    if (k === 'n' || k === 'N' || k === 'ArrowRight') { e.preventDefault(); refresh(true); }
    else if (k === 'p' || k === 'P' || k === 'ArrowLeft') { e.preventDefault(); showPrevious(); }
    else if (k === 'l') stepLivery(1);
    else if (k === 'L') stepLivery(-1);
    else if (k === 'f' || k === 'F') { const z = !settings.zen; settings.zen = z; document.body.classList.toggle('zen', z); toast(z ? 'Focus view on (F to turn off)' : 'Focus view off'); BR.saveSettings({ zen: z }); }
    else if (k === '/') { e.preventDefault(); if (settings.search) document.getElementById('q').focus(); }
    else if (k === '?') helpEl.hidden = !helpEl.hidden;
    else if (k === 'Escape') helpEl.hidden = true;
  });

  setInterval(tickClock, 1000);
  BR.migrate().catch(() => 0)
    .then(() => ClaudeSketch.drainInbox().catch(() => 0))
    .then(() => refresh())
    .catch((e) => { console.error(e); announce(); });
})();
