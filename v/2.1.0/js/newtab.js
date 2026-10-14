if (!Bridge.inShell) showNotInShell();
else (() => {
  const layers = [document.getElementById('bgA'), document.getElementById('bgB')];
  const timeEl = document.getElementById('time');
  const dateEl = document.getElementById('date');
  const creditEl = document.getElementById('credit');
  const keepBtn = document.getElementById('keepBtn');
  let front = 0, blobUrl = null, shownId = null, currentRec = null, timer = null, announced = false;
  let settings = { ...BR.DEFAULTS };

  const announce = () => { if (!announced) { announced = true; Bridge.ready(); } };

  // Crossfade to an image by id. Returns false if it can't be shown (e.g. a dead web link).
  async function show(id) {
    if (id == null) return false;
    if (id === shownId) return true;
    const rec = await BR.getImage(id);
    if (!rec) return false;
    const isBlob = !!rec.blob;
    const url = isBlob ? URL.createObjectURL(rec.blob) : rec.url;
    if (!url) return false;
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { if (isBlob) URL.revokeObjectURL(url); return false; }
    const back = layers[1 - front];
    back.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
    back.classList.add('visible');
    layers[front].classList.remove('visible');
    const old = blobUrl;
    blobUrl = isBlob ? url : null;
    front = 1 - front; shownId = id; currentRec = rec;
    if (old) setTimeout(() => URL.revokeObjectURL(old), 1500);
    updateMeta();
    announce();
    return true;
  }

  function updateMeta() {
    const r = currentRec;
    const c = r && r.credit;
    if (c && settings.showCredit) {
      creditEl.textContent = [c.title, c.creator && 'by ' + c.creator, c.site || c.license].filter(Boolean).join(' · ');
      if (c.link) creditEl.href = c.link; else creditEl.removeAttribute('href');
      creditEl.classList.remove('off');
    } else {
      creditEl.classList.add('off');
    }
    keepBtn.classList.toggle('off', !(r && r.source === 'web' && r.theme));
    keepBtn.classList.toggle('kept', !!(r && r.keep));
    keepBtn.title = r && r.keep
      ? 'Kept: this photo stays when the search refreshes (click to undo)'
      : 'Keep this photo when the search refreshes';
  }

  function applyUI(s) {
    document.getElementById('clock').classList.toggle('off', !s.clock);
    document.getElementById('search').classList.toggle('off', !s.search);
    document.getElementById('dim').style.opacity = s.dim / 100;
    tickClock();
    updateMeta();
  }

  function tickClock() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], settings.clock24
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: 'numeric', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function schedule() {
    clearTimeout(timer);
    const ms = BR.msUntilNext(settings);
    if (ms != null) timer = setTimeout(refresh, Math.min(ms, 2 ** 31 - 1));
  }

  async function refresh(force = false) {
    const [ids, s] = await Promise.all([BR.getIds(), BR.getSettings()]);
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

  Bridge.onStorage(async (c) => {
    const s = await BR.getSettings();
    settings = s;
    if (['clock', 'clock24', 'search', 'dim', 'showCredit'].some((k) => k in c)) applyUI(s);
    if ('mode' in c || 'intervalMin' in c) schedule();
    if ('currentId' in c && s.mode !== 'newtab' && s.currentId != null) { await show(s.currentId); schedule(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && settings.mode !== 'newtab') refresh();
  });

  document.getElementById('nextBtn').addEventListener('click', (e) => {
    const b = e.currentTarget;
    b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
    refresh(true);
  });
  keepBtn.addEventListener('click', async () => {
    if (!currentRec) return;
    currentRec.keep = !currentRec.keep;
    await BR.putImage(currentRec);
    updateMeta();
  });
  document.getElementById('settingsBtn').addEventListener('click', () => Bridge.call('openSettings'));
  document.getElementById('addBtn').addEventListener('click', () => Bridge.call('openSettings'));
  document.getElementById('search').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('q').value.trim();
    if (text) Bridge.call('search', { text });
  });

  setInterval(tickClock, 1000);
  refresh().catch((e) => { console.error(e); announce(); });
  // Refresh auto-rotating searches in the background once this tab has settled.
  setTimeout(() => BR.refreshDueThemes().catch((e) => console.warn(e)), 4000);
})();
