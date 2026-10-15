if (!Bridge.inShell) showNotInShell();
else (() => {
  const $ = (sel) => document.querySelector(sel);
  let settings = { ...BR.DEFAULTS };
  let toastTimer;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function status(msg, isErr = false, target = '#clStatus') {
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
  const look = () => BR.look(settings);
  const save = async (patch) => { Object.assign(settings, patch); await BR.saveSettings(patch); };
  const tile = (box, sk, thumb = true) => {
    box.style.background = Sketch.background(look());
    box.innerHTML = Sketch.render(sk, look(), { thumb });
  };

  // ---------- Load ----------
  async function loadSettings() {
    settings = await BR.getSettings();
    const s = settings;
    for (const k of ['sketchStyle', 'textPos', 'clockStyle', 'mode', 'intervalMin', 'order', 'claudeKey']) $('#' + k).value = String(s[k] ?? '');
    for (const k of ['animate', 'clock24', 'showDate', 'showSeconds', 'search']) $('#' + k).checked = !!s[k];
    $('#skText').value = s.sketchText || '';
    $('#ecoSw').checked = s.eco;
    $('#intervalRow').hidden = s.mode !== 'interval';
    $('#claudeModel').replaceChildren(...Object.entries(ClaudeSketch.MODELS).map(([v, label]) => {
      const o = el('option', null, label); o.value = v; return o;
    }));
    $('#claudeModel').value = s.claudeModel || 'claude-sonnet-5-5';
    $('#motion').replaceChildren(...Object.entries(Sketch.MOTIONS).map(([v, label]) => {
      const o = el('option', null, label); o.value = v; return o;
    }));
    $('#motion').value = s.motion || 'auto';
    renderSwatches();
    updateEco();
  }

  // ---------- Look ----------
  function renderSwatches() {
    const box = $('#swatches');
    box.replaceChildren();
    for (const [key, a] of Object.entries(Sketch.ACCENTS)) {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.title = a.name;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', a.name);
      b.setAttribute('aria-checked', String(settings.accent === key));
      b.style.background = a.stroke;
      b.addEventListener('click', async () => { await save({ accent: key }); renderAllLooks(); });
      box.append(b);
    }
    $('#accentRow').hidden = settings.sketchStyle !== 'neon';
  }
  // Full-size render (not a thumbnail) so the chosen motion plays in the preview.
  function renderLookPreview() {
    const box = $('#lookPreview');
    box.style.background = Sketch.background(look());
    box.innerHTML = Sketch.render({ subject: 'chinook', text: settings.sketchText || 'FOCUS' }, look(), {});
  }
  function renderAllLooks() {
    renderSwatches();
    renderLookPreview();
    renderPicker();
    renderPreview();
    renderLibrary();
  }

  // ---------- Ready-made picker (built-ins + your saved drawings) ----------
  const picked = new Set();
  const customs = () => (Array.isArray(settings.customSketches) ? settings.customSketches : []);
  const subjectFor = (id) => (Sketch.SUBJECTS[id] ? { subject: id } : (() => {
    const c = customs().find((x) => x.id === id);
    return c ? { subject: id, custom: c } : null;
  })());

  function renderPicker() {
    const grid = $('#skGrid');
    grid.replaceChildren();
    const all = [...Object.entries(Sketch.SUBJECTS).map(([id, s]) => [id, s, null]), ...customs().map((c) => [c.id, c, c])];
    for (const [id, subj, custom] of all) {
      const fig = el('figure', 'sk-tile' + (picked.has(id) ? ' sel' : ''));
      tile(fig, { subject: id, custom: custom || undefined, text: '' });
      fig.append(el('figcaption', null, (custom ? (custom.by === 'claude' ? '✨ ' : '🎲 ') : '') + subj.name));
      fig.title = subj.name;
      fig.addEventListener('click', () => {
        picked.has(id) ? picked.delete(id) : picked.add(id);
        fig.classList.toggle('sel', picked.has(id));
        updatePicker();
      });
      if (custom) {
        const rm = el('button', 'rm', '×');
        rm.title = 'Remove from this list';
        rm.addEventListener('click', async (e) => {
          e.stopPropagation();
          picked.delete(id);
          await save({ customSketches: customs().filter((c) => c.id !== id) });
          renderPicker();
        });
        fig.append(rm);
      }
      grid.append(fig);
    }
    updatePicker();
  }
  function updatePicker() {
    const n = picked.size, total = Object.keys(Sketch.SUBJECTS).length + customs().length;
    $('#skAdd').disabled = !n;
    $('#skAdd').textContent = n ? `Add ${n} sketch${n > 1 ? 'es' : ''}` : 'Add selected';
    $('#skAll').textContent = n === total ? 'Select none' : 'Select all';
  }
  $('#skAll').addEventListener('click', () => {
    const all = [...Object.keys(Sketch.SUBJECTS), ...customs().map((c) => c.id)];
    if (picked.size === all.length) picked.clear(); else all.forEach((k) => picked.add(k));
    renderPicker();
  });
  $('#skAdd').addEventListener('click', async () => {
    const text = Sketch.cleanText($('#skText').value);
    const recs = [...picked].map(subjectFor).filter(Boolean).map((sub) => ({
      name: (sub.custom ? sub.custom.name : Sketch.SUBJECTS[sub.subject].name), source: 'sketch', added: Date.now(),
      sketch: { ...sub, text }
    }));
    const ids = await BR.addRecords(recs);
    if (ids && ids.length) await save({ currentId: ids[0], lastChange: Date.now() });
    picked.clear();
    renderPicker();
    $('#skStatus').textContent = `Added ${recs.length}. Open a new tab to watch one draw in.`;
    toast(`Added ${recs.length} sketch${recs.length > 1 ? 'es' : ''}`);
    renderLibrary();
  });
  $('#skText').addEventListener('change', (e) => { e.target.value = Sketch.cleanText(e.target.value); save({ sketchText: e.target.value }); renderLookPreview(); });

  // ---------- Preview (shared by Surprise me and Claude) ----------
  let pending = null;   // { subj, again }
  function showPreview(subj, again, note) {
    pending = { subj, again };
    $('#pvText').value = subj.text ? subj.text : Sketch.cleanText($('#skText').value);
    $('#pvNote').textContent = note || '';
    $('#pvKeep').disabled = false;
    $('#preview').hidden = false;
    renderPreview(true);
    $('#preview').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function renderPreview(animate = false) {
    if (!pending) return;
    const box = $('#pvCanvas');
    box.style.background = Sketch.background(look());
    box.innerHTML = Sketch.render({ subject: pending.subj.id, custom: pending.subj, text: $('#pvText').value },
      { ...look(), animate: animate && settings.animate }, {});
  }
  $('#pvText').addEventListener('input', () => renderPreview());
  $('#pvAgain').addEventListener('click', () => pending && pending.again());
  $('#pvKeep').addEventListener('click', async () => {
    if (!pending) return;
    const { subj } = pending;
    const text = Sketch.cleanText($('#pvText').value);
    const saved = { id: subj.id, name: subj.name, size: subj.size, zoom: subj.zoom, paths: subj.paths, circles: subj.circles, faint: subj.faint, by: subj.by };
    await save({ customSketches: [...customs().filter((c) => c.id !== saved.id), saved].slice(-60) });
    const ids = await BR.addRecords([{ name: saved.name, source: 'sketch', added: Date.now(),
      sketch: { subject: saved.id, custom: saved, text } }]);
    if (ids && ids.length) await save({ currentId: ids[0], lastChange: Date.now() });
    $('#pvKeep').disabled = true;
    renderPicker();
    renderLibrary();
    toast(`Added "${saved.name}". Open a new tab to watch it draw in.`);
  });

  // ---------- Surprise me (offline generators) ----------
  function surprise(kind) {
    const g = Sketch.generate(kind);
    showPreview({ ...g, by: 'app', text: '' }, () => surprise(kind), 'Made on your computer. Press "Another" for a new variation.');
  }
  const genRow = $('#genRow');
  const anyBtn = el('button', 'btn sm', '🎲 Surprise me');
  anyBtn.type = 'button';
  anyBtn.addEventListener('click', () => surprise());
  genRow.append(anyBtn);
  for (const [kind, g] of Object.entries(Sketch.GENERATORS)) {
    const b = el('button', 'btn ghost sm', g.name);
    b.type = 'button';
    b.addEventListener('click', () => surprise(kind));
    genRow.append(b);
  }

  // ---------- Claude ----------
  async function claudeDraw() {
    const prompt = $('#clInput').value.trim();
    if (!prompt) { status('Type what you want Claude to draw first.', true); $('#clInput').focus(); return; }
    const btn = $('#clBtn');
    if (btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    status(`Claude is drawing "${prompt}"…`);
    try {
      const r = await ClaudeSketch.draw(prompt);
      status('');
      showPreview({ ...r, by: 'claude' }, claudeDraw, r.text ? `Claude added the word "${r.text}". You can change it.` : '');
      updateEco();
    } catch (e) {
      status(e.message, true);
    } finally {
      btn.classList.remove('busy');
    }
  }
  $('#clForm').addEventListener('submit', (e) => { e.preventDefault(); claudeDraw(); });
  const syncKeyBox = () => { $('#clKeyBox').hidden = !(settings.claudeKey || '').trim(); };

  // Paste from Sketch Studio (backup for when sync is off): {"backdropSketches":[...]} or a single drawing.
  async function afterImport(n, from) {
    settings = await BR.getSettings();
    renderPicker();
    await renderLibrary();
    if (n) toast(n === 1 ? `Added 1 sketch from ${from}. Open a new tab to watch it draw in.` : `Added ${n} sketches from ${from}.`);
  }
  async function importPasted() {
    const raw = $('#clReply').value.trim();
    if (!raw) return;
    let list = null;
    try { const j = JSON.parse(raw); if (j && Array.isArray(j.backdropSketches)) list = j.backdropSketches; } catch (e) {}
    try { if (!list) list = [ClaudeSketch.fromPaste(raw)]; } catch (e) { status(e.message, true); return; }
    const n = await ClaudeSketch.importSketches(list);
    $('#clReply').value = '';
    status(n ? '' : 'Those sketches are already in your library.');
    await afterImport(n, 'Sketch Studio');
  }
  async function syncStudio() { const n = await ClaudeSketch.drainInbox().catch(() => 0); if (n) await afterImport(n, 'Sketch Studio'); }
  $('#clReply').addEventListener('paste', () => setTimeout(importPasted, 0));
  $('#clReply').addEventListener('change', importPasted);
  $('#claudeKey').addEventListener('change', async (e) => { await save({ claudeKey: e.target.value.trim() }); syncKeyBox(); });
  $('#claudeModel').addEventListener('change', (e) => save({ claudeModel: e.target.value }));

  // ---------- Library ----------
  async function renderLibrary() {
    const [all, legacy] = await Promise.all([BR.getSketches(), BR.legacyIds()]);
    const grid = $('#grid');
    grid.replaceChildren();
    $('#count').textContent = all.length ? `(${all.length})` : '';
    $('#libEmpty').hidden = !!all.length;
    for (const rec of all.slice().reverse()) {
      const fig = el('figure');
      if (rec.id === settings.currentId) fig.classList.add('current');
      const box = el('div', 'sk-thumb');
      tile(box, { ...rec.sketch, text: '' });
      fig.append(box);
      fig.title = `${rec.name} (click to show now)`;
      if (rec.sketch.text) fig.append(el('span', 'word', rec.sketch.text));
      const edit = el('button', 'edit', '✎');
      edit.title = 'Change the word';
      edit.addEventListener('click', async (e) => {
        e.stopPropagation();
        const v = prompt('Word on this sketch (leave empty for none):', rec.sketch.text || '');
        if (v === null) return;
        rec.sketch.text = Sketch.cleanText(v);
        await BR.putImage(rec);
        await save({ lastChange: Date.now(), currentId: rec.id });
        renderLibrary();
      });
      const del = el('button', 'del', '×');
      del.title = 'Remove';
      del.addEventListener('click', async (e) => { e.stopPropagation(); await BR.deleteImage(rec.id); renderLibrary(); });
      fig.addEventListener('click', async () => {
        await save({ currentId: rec.id, lastChange: Date.now() });
        renderLibrary();
        toast('Showing this sketch now');
      });
      fig.append(edit, del);
      grid.append(fig);
    }
    const lg = $('#legacy');
    lg.hidden = !legacy.length;
    if (legacy.length) {
      lg.replaceChildren(el('span', null, `${legacy.length} photo${legacy.length > 1 ? 's' : ''} from older versions ${legacy.length > 1 ? 'are' : 'is'} still stored but never shown.`));
      const b = el('button', 'btn danger sm', 'Delete them');
      b.addEventListener('click', async () => {
        if (!confirm(`Delete ${legacy.length} old photo${legacy.length > 1 ? 's' : ''}? This frees up space and can't be undone.`)) return;
        await BR.deleteMany(legacy);
        toast('Old photos deleted');
        renderLibrary();
        updateFooter();
      });
      lg.append(b);
    }
  }

  // ---------- Look + new tab settings ----------
  $('#sketchStyle').addEventListener('change', async (e) => { await save({ sketchStyle: e.target.value }); renderAllLooks(); });
  $('#textPos').addEventListener('change', async (e) => { await save({ textPos: e.target.value }); renderLookPreview(); renderPreview(); });
  $('#animate').addEventListener('change', (e) => save({ animate: e.target.checked }));
  $('#motion').addEventListener('change', async (e) => { await save({ motion: e.target.value }); renderLookPreview(); });
  $('#clockStyle').addEventListener('change', (e) => save({ clockStyle: e.target.value }));
  for (const k of ['clock24', 'showDate', 'showSeconds', 'search']) $('#' + k).addEventListener('change', (e) => save({ [k]: e.target.checked }));
  $('#mode').addEventListener('change', (e) => {
    $('#intervalRow').hidden = e.target.value !== 'interval';
    save({ mode: e.target.value, lastChange: Date.now() });
  });
  $('#intervalMin').addEventListener('change', (e) => {
    const v = Math.min(1440, Math.max(1, parseInt(e.target.value, 10) || 30));
    e.target.value = v;
    save({ intervalMin: v });
  });
  $('#order').addEventListener('change', (e) => save({ order: e.target.value, deck: [] }));

  // ---------- Safety + Eco ----------
  async function updateEco() {
    $('#ecoBadge').hidden = !settings.eco;
    const s = await BR.getSettings();
    const n = s.aiDay && s.aiDay.d === new Date().toDateString() ? s.aiDay.n : 0;
    $('#aiCount').textContent = settings.eco ? `(${n} of ${BR.ECO.aiPerDay} used today)` : '';
    $('#claudeModel').disabled = settings.eco;
    $('#claudeModel').title = settings.eco ? 'Eco mode uses Haiku' : '';
    $('#motion').disabled = settings.eco;
    $('#motionNote').textContent = settings.eco ? '(off in Eco mode)' : '';
    renderLookPreview();
  }
  $('#ecoSw').addEventListener('change', async (e) => { await save({ eco: e.target.checked }); updateEco(); toast(e.target.checked ? 'Eco mode on' : 'Eco mode off'); });
  $('#appStop').addEventListener('click', () => Bridge.call('stop'));
  $('#openControl').addEventListener('click', () => Bridge.call('openControl'));

  async function showSafetyInfo() {
    const info = await Bridge.call('info').catch(() => null);
    if (!info) return;
    const b = $('#updBanner');
    if (info.update) {
      b.replaceChildren(el('span', null, `Version ${info.update.version} of the app is ready. Review what changed and approve it in the Control Center.`));
      const btn = el('button', 'btn sm', 'Review update');
      btn.addEventListener('click', () => Bridge.call('openControl'));
      b.append(btn);
      b.hidden = false;
    } else b.hidden = true;
  }
  const mb = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1e6)) + ' MB');
  async function updateFooter() {
    let usage = '', shell = '';
    try { const e = await Bridge.call('estimate'); if (e && e.usage) usage = ` · using ${mb(e.usage)} of storage`; } catch (e) { /* optional */ }
    try { shell = (await Bridge.call('info')).shellVersion; } catch (e) { /* optional */ }
    $('#footer').textContent = `Backdrop Rotator app ${APP_VERSION} · extension ${shell}${usage}`;
  }

  Bridge.onStorage((c) => { if ('studioInbox' in c) syncStudio(); if ('currentId' in c) { BR.getSettings().then((s) => { settings = s; renderLibrary(); }); } });

  loadSettings()
    .then(async () => { await syncStudio(); syncKeyBox(); renderLookPreview(); renderPicker(); return Promise.all([renderLibrary(), showSafetyInfo(), updateFooter()]); })
    .finally(() => Bridge.ready());
})();
