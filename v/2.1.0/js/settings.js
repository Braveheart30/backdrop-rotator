if (!Bridge.inShell) showNotInShell();
else (() => {
  const $ = (sel) => document.querySelector(sel);
  let thumbUrls = [];
  let toastTimer;
  let busy = false;
  let libLimit = 120;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function status(msg, isErr = false, target = '#themeStatus') {
    const e = $(target);
    e.textContent = msg || '';
    e.classList.toggle('err', isErr);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function timeAgo(ts) {
    if (!ts) return 'never';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  }

  const gb = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1e6)) + ' MB');

  async function loadSettings() {
    const s = await BR.getSettings();
    const set = (id, v) => { $('#' + id).value = String(v); };
    ['mode', 'intervalMin', 'order', 'perTheme', 'autoRefresh', 'aiStyle', 'aiEngine', 'aiTextMode',
     'aiFont', 'aiTextPos', 'openaiKey', 'openaiModel', 'openaiQuality', 'dim'].forEach((k) => set(k, s[k]));
    if (![...$('#perTheme').options].some((o) => o.value === String(s.perTheme))) set('perTheme', 50);
    for (const k of ['clock', 'clock24', 'search', 'showCredit']) $('#' + k).checked = s[k];
    $('#dimOut').textContent = s.dim + '%';
    $('#intervalRow').hidden = s.mode !== 'interval';
    $('#ecoSw').checked = s.eco;
    updateEco(s.eco);
    updateAiUI();
  }

  async function updateEco(on) {
    $('#ecoBadge').hidden = !on;
    const n = await AI.usedToday();
    $('#aiCount').textContent = on ? `(${n} of ${BR.ECO.aiPerDay} used today)` : '';
    const q = $('#openaiQuality');
    q.disabled = on;
    q.title = on ? 'Eco mode uses Low quality' : '';
    const opts = [...$('#perTheme').options];
    opts.forEach((o) => { o.disabled = on && +o.value > BR.ECO.maxPerSearch; });
  }

  async function showSafetyInfo() {
    const info = await Bridge.call('info').catch(() => null);
    if (!info) return;
    const b = $('#updBanner');
    if (info.update) {
      b.replaceChildren();
      const t = document.createElement('span');
      t.textContent = `Version ${info.update.version} of the app is ready. Review what changed and approve it in the Control Center.`;
      const btn = document.createElement('button');
      btn.className = 'btn sm';
      btn.textContent = 'Review update';
      btn.addEventListener('click', () => Bridge.call('openControl'));
      b.append(t, btn);
      b.hidden = false;
    } else b.hidden = true;
    const off = Object.entries(info.perms || {}).filter(([, v]) => !v).length;
    $('#openControl').textContent = off ? `Control Center (${off} access setting${off > 1 ? 's' : ''} off)` : 'Control Center: access & updates';
  }

  // ---------- Auto-rotating searches + library ----------

  async function render() {
    const [all, s] = await Promise.all([BR.getAll(), BR.getSettings()]);

    const list = $('#themeList');
    list.replaceChildren();
    if (!s.themes.length) list.append(el('p', 'empty-note', 'None yet. Search above and click “Auto-rotate this search”.'));
    for (const t of s.themes) {
      const n = all.filter((r) => r.source === 'web' && r.theme === t.key).length;
      const row = el('div', 'theme');
      const info = el('div');
      info.append(el('strong', null, t.name), el('span', 'meta', `${n} photo${n === 1 ? '' : 's'} · updated ${timeAgo(t.lastFetched)}`));
      const actions = el('div', 'actions');
      const again = el('button', 'btn ghost sm', 'New set');
      again.title = 'Swap in a new set now (♥ kept photos stay)';
      again.addEventListener('click', () => runFetch(t.name, true));
      const rm = el('button', 'btn danger sm', 'Remove');
      rm.addEventListener('click', async () => {
        if (!confirm(`Stop auto-rotating "${t.name}" and remove its photos? Photos you marked ♥ stay.`)) return;
        await BR.removeTheme(t.key);
        toast(`Removed "${t.name}"`);
        render();
      });
      again.disabled = rm.disabled = busy;
      actions.append(again, rm);
      row.append(info, actions);
      list.append(row);
    }

    thumbUrls.forEach((u) => URL.revokeObjectURL(u));
    thumbUrls = [];
    const grid = $('#grid');
    grid.replaceChildren();
    $('#count').textContent = all.length ? `(${all.length.toLocaleString()})` : '';
    $('#clear').disabled = !all.length;
    $('#drop').classList.toggle('big', !all.length);
    const themeNames = Object.fromEntries(s.themes.map((t) => [t.key, t.name]));

    const shownRecs = all.slice().reverse().slice(0, libLimit); // newest first
    for (const rec of shownRecs) {
      let url = rec.url;
      if (rec.blob) { url = URL.createObjectURL(rec.blob); thumbUrls.push(url); }
      const fig = el('figure');
      if (rec.id === s.currentId) fig.classList.add('current');
      fig.title = `${rec.name} (click to show now)`;
      const img = el('img');
      img.src = url; img.loading = 'lazy'; img.decoding = 'async'; img.alt = rec.name;
      img.addEventListener('error', () => fig.classList.add('broken'));
      fig.append(img);
      const tag = rec.source === 'ai' ? 'AI' : rec.theme ? (themeNames[rec.theme] || rec.theme) : '';
      if (tag) fig.append(el('span', 'tag', (rec.keep && rec.theme ? '♥ ' : '') + tag));
      const del = el('button', 'del', '×');
      del.title = 'Remove';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await BR.deleteImage(rec.id);
        render();
      });
      fig.addEventListener('click', async () => {
        await BR.saveSettings({ currentId: rec.id, lastChange: Date.now() });
        toast('Set as current background');
      });
      fig.append(del);
      grid.append(fig);
    }
    $('#libMore').hidden = all.length <= libLimit;
    $('#libMore').textContent = `Show more (${(all.length - libLimit).toLocaleString()} hidden)`;
    updateFooter();
  }

  async function updateFooter() {
    let usage = '';
    try { const e = await Bridge.call('estimate'); if (e && e.usage) usage = ` · using ${gb(e.usage)} of storage`; } catch (e) { /* optional */ }
    let shell = '';
    try { shell = (await Bridge.call('info')).shellVersion; } catch (e) { /* optional */ }
    $('#footer').textContent = `Backdrop Rotator app ${APP_VERSION} · extension ${shell}${usage}`;
  }

  async function runFetch(name, replace) {
    if (busy) return;
    busy = true;
    $('#saveTheme').disabled = true;
    render();
    status(`Finding photos for "${name}"…`);
    document.getElementById('auto').scrollIntoView();
    try {
      const n = await BR.fetchTheme(name, {
        replace,
        onProgress: (done, want) => status(`Downloading photos for "${name}"… ${done} of up to ${want.toLocaleString()}`)
      });
      status('');
      toast(`"${name}" now auto-rotates (${n.toLocaleString()} photos)`);
    } catch (e) {
      status(e.message || 'Something went wrong fetching photos.', true);
    } finally {
      busy = false;
      $('#saveTheme').disabled = false;
      render();
    }
  }

  // ---------- Search ----------

  let query = '', nextFirst = 0, level = null;
  const picks = new Map();
  const shown = new Map();

  function updatePicks() {
    const n = picks.size;
    $('#pickCount').textContent = n ? `${n} selected` : 'Click photos to select them';
    $('#addPicked').disabled = !n;
    $('#addPicked').textContent = n ? `Add ${n} selected` : 'Add selected';
  }

  function togglePick(c, fig, on) {
    if (fig.classList.contains('added')) return;
    const sel = on ?? !picks.has(c.key);
    if (sel) { picks.set(c.key, { c, fig }); fig.classList.add('sel'); }
    else { picks.delete(c.key); fig.classList.remove('sel'); }
  }

  async function doSearch() {
    $('#searchBtn').disabled = true;
    $('#moreBtn').disabled = true;
    status(nextFirst ? 'Loading more…' : `Searching for "${query}"…`, false, '#searchStatus');
    try {
      const res = await BR.searchImages(query, nextFirst, level);
      level = res.level;
      nextFirst += 35;
      for (const c of res.results.filter((r) => !shown.has(r.key))) {
        const fig = el('figure', 'pick');
        shown.set(c.key, { c, fig });
        fig.title = c.title || c.full;
        const img = el('img');
        img.src = c.thumb; img.loading = 'lazy'; img.alt = c.title;
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { fig.remove(); shown.delete(c.key); });
        fig.append(img);
        fig.addEventListener('click', () => { togglePick(c, fig); updatePicks(); });
        $('#results').append(fig);
      }
      $('#resultsBar').hidden = !shown.size;
      $('#moreBtn').hidden = res.results.length < 20;
      status(shown.size ? '' : `No photos found for "${query}". Try different wording.`, !shown.size, '#searchStatus');
    } catch (e) {
      status(e.message, true, '#searchStatus');
    } finally {
      $('#searchBtn').disabled = false;
      $('#moreBtn').disabled = false;
    }
  }

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (!q) return;
    query = q; nextFirst = 0; level = null;
    picks.clear(); shown.clear();
    $('#results').replaceChildren();
    updatePicks();
    doSearch();
  });
  $('#moreBtn').addEventListener('click', doSearch);
  $('#selectAll').addEventListener('click', () => {
    const allSel = [...shown.values()].every(({ c, fig }) => picks.has(c.key) || fig.classList.contains('added'));
    shown.forEach(({ c, fig }) => togglePick(c, fig, !allSel));
    $('#selectAll').textContent = allSel ? 'Select all' : 'Select none';
    updatePicks();
  });

  $('#addPicked').addEventListener('click', async () => {
    const items = [...picks.values()];
    if (!items.length) return;
    $('#addPicked').disabled = true;
    const { added, failed } = await BR.addPicked(items.map((p) => p.c),
      (d, n) => status(`Downloading full-size photos… ${d}/${n}`, false, '#searchStatus'));
    for (const p of items) { p.fig.classList.remove('sel'); p.fig.classList.add('added'); }
    picks.clear();
    updatePicks();
    status(failed ? `${failed} photo${failed > 1 ? 's' : ''} couldn't be downloaded (the website blocked it). Try picking others.` : '', !!failed, '#searchStatus');
    if (added) toast(`Added ${added} photo${added > 1 ? 's' : ''} to your backgrounds`);
    render();
  });

  $('#saveTheme').addEventListener('click', async () => {
    if (!query) return;
    const s = await BR.getSettings();
    runFetch(query, s.themes.some((t) => t.key === BR.themeKey(query)));
  });

  $('#urlForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#urlInput').value.trim();
    status('Downloading…', false, '#searchStatus');
    try {
      await BR.addFromUrl(url);
      $('#urlInput').value = '';
      status('', false, '#searchStatus');
      toast('Added image');
      render();
    } catch (err) {
      status(err.message, true, '#searchStatus');
    }
  });

  // ---------- Create with AI ----------

  let lastGen = null;

  function updateAiUI() {
    const engine = $('#aiEngine').value;
    const free = engine === 'free';
    const overlay = free || $('#aiTextMode').value === 'overlay';
    $('#textModeWrap').hidden = free;
    $('#fontWrap').hidden = !overlay;
    $('#posWrap').hidden = !overlay;
    const eco = $('#ecoSw').checked;
    $('#engineNote').textContent = (eco ? '🌱 Eco mode: lighter, lower-resolution generation, 5 images a day. ' : '') + (free
      ? 'Free generator: lower resolution (upscaled to fit your screen) with a small pollinations.ai mark. It can’t spell reliably, so your text is added as clean lettering on top.'
      : 'OpenAI: sharp, ChatGPT-quality images that can draw your words into the scene. Uses your own OpenAI key, which is billed per image.');
    if (!free && !$('#openaiKey').value) $('#openaiBox').open = true;
  }

  for (const id of ['aiStyle', 'aiEngine', 'aiTextMode', 'aiFont', 'aiTextPos', 'openaiQuality']) {
    $('#' + id).addEventListener('change', (e) => { BR.saveSettings({ [id]: e.target.value }); updateAiUI(); });
  }
  $('#openaiKey').addEventListener('change', (e) => { BR.saveSettings({ openaiKey: e.target.value.trim() }); updateAiUI(); });
  $('#openaiModel').addEventListener('change', (e) => BR.saveSettings({ openaiModel: e.target.value.trim() || 'gpt-image-2' }));

  async function generate() {
    const btn = $('#genBtn');
    if (btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    $('#aiAgain').disabled = true;
    const engine = $('#aiEngine').value;
    status(engine === 'openai' ? 'Creating your image… this can take up to a minute.' : 'Creating your image… usually 5 to 30 seconds.', false, '#aiStatus');
    const opts = {
      prompt: $('#aiPrompt').value, text: $('#aiText').value, style: $('#aiStyle').value, engine,
      textMode: $('#aiTextMode').value, font: $('#aiFont').value, pos: $('#aiTextPos').value
    };
    try {
      const blob = await AI.generate(opts);
      lastGen = { blob, ...opts };
      const img = $('#aiImg');
      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      img.src = URL.createObjectURL(blob);
      $('#aiPreview').hidden = false;
      $('#aiSave').disabled = $('#aiShow').disabled = false;
      status('', false, '#aiStatus');
      updateEco($('#ecoSw').checked);
    } catch (e) {
      status(e.message, true, '#aiStatus');
    } finally {
      btn.classList.remove('busy');
      $('#aiAgain').disabled = false;
    }
  }

  async function saveGen(showNow) {
    if (!lastGen) return;
    const label = (lastGen.text || lastGen.prompt).trim().replace(/\s+/g, ' ').slice(0, 70);
    const [id] = await BR.addRecords([{
      name: label, type: 'image/jpeg', blob: lastGen.blob, added: Date.now(), source: 'ai', keep: true,
      credit: { title: 'AI: ' + label, site: lastGen.engine === 'openai' ? 'OpenAI' : 'Pollinations' }
    }]);
    if (showNow) await BR.saveSettings({ currentId: id, lastChange: Date.now() });
    $('#aiSave').disabled = $('#aiShow').disabled = true;
    toast(showNow ? 'Saved. Open a new tab to see it.' : 'Saved to your backgrounds');
    render();
  }

  $('#genBtn').addEventListener('click', generate);
  $('#aiAgain').addEventListener('click', generate);
  $('#aiSave').addEventListener('click', () => saveGen(false));
  $('#aiShow').addEventListener('click', () => saveGen(true));

  // ---------- Safety + Eco ----------

  $('#appStop').addEventListener('click', () => Bridge.call('stop'));
  $('#openControl').addEventListener('click', () => Bridge.call('openControl'));
  $('#ecoSw').addEventListener('change', async (e) => {
    const on = e.target.checked;
    const patch = { eco: on };
    const s = await BR.getSettings();
    if (on && s.perTheme > BR.ECO.maxPerSearch) { patch.perTheme = BR.ECO.maxPerSearch; $('#perTheme').value = String(BR.ECO.maxPerSearch); }
    await BR.saveSettings(patch);
    updateEco(on);
    updateAiUI();
    toast(on ? 'Eco mode on' : 'Eco mode off');
  });

  // ---------- Settings ----------

  $('#perTheme').addEventListener('change', (e) => BR.saveSettings({ perTheme: +e.target.value }));
  $('#autoRefresh').addEventListener('change', (e) => BR.saveSettings({ autoRefresh: e.target.value }));
  $('#mode').addEventListener('change', (e) => {
    $('#intervalRow').hidden = e.target.value !== 'interval';
    BR.saveSettings({ mode: e.target.value, lastChange: Date.now() });
  });
  $('#intervalMin').addEventListener('change', (e) => {
    const v = Math.min(1440, Math.max(1, parseInt(e.target.value, 10) || 30));
    e.target.value = v;
    BR.saveSettings({ intervalMin: v });
  });
  $('#order').addEventListener('change', (e) => BR.saveSettings({ order: e.target.value, deck: [] }));
  for (const k of ['clock', 'clock24', 'search', 'showCredit']) {
    $('#' + k).addEventListener('change', (e) => BR.saveSettings({ [k]: e.target.checked }));
  }
  $('#dim').addEventListener('input', (e) => {
    $('#dimOut').textContent = e.target.value + '%';
    BR.saveSettings({ dim: +e.target.value });
  });

  // ---------- Your own images ----------

  async function addFiles(list) {
    const imgs = [...list].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return toast('No images found in that selection');
    await BR.addImages(imgs);
    toast(`Added ${imgs.length} image${imgs.length > 1 ? 's' : ''}`);
    render();
  }

  $('#files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  $('#folder').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  $('#libMore').addEventListener('click', () => { libLimit += 240; render(); });
  $('#clear').addEventListener('click', async () => {
    if (!confirm('Remove all images, including AI images and auto-rotating search photos?')) return;
    await BR.clearAll();
    await BR.saveSettings({ currentId: null, deck: [], themes: [], seen: {} });
    render();
  });

  const drop = $('#drop');
  document.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) drop.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  Bridge.onStorage((c) => { if ('currentId' in c || 'themes' in c) render(); });

  Promise.all([loadSettings(), render(), showSafetyInfo()]).finally(() => Bridge.ready());
})();
