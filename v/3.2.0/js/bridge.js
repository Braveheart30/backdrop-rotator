// Talks to the Backdrop Rotator extension shell that hosts this page in a frame.
// The shell provides storage, unrestricted downloads and browser search; this app provides everything else.
const Bridge = (() => {
  const parentOrigin = (location.ancestorOrigins && location.ancestorOrigins[0]) || '';
  const inShell = window.parent !== window && /^(chrome-extension|extension):\/\//.test(parentOrigin);
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();

  window.addEventListener('message', (e) => {
    if (!inShell || e.source !== window.parent || e.origin !== parentOrigin) return;
    const m = e.data;
    if (!m || m.__br !== 1) return;
    if (m.event === 'storage') { listeners.forEach((f) => f(m.changes)); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
  });

  function call(op, args) {
    if (!inShell) return Promise.reject(new Error('Open Backdrop Rotator from the Edge extension.'));
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      window.parent.postMessage({ __br: 1, id, op, args }, parentOrigin);
    });
  }

  return {
    inShell,
    call,
    ready: () => inShell && window.parent.postMessage({ __br: 1, op: 'ready' }, parentOrigin),
    onStorage: (f) => listeners.add(f)
  };
})();

// Shown when someone opens the app page directly instead of through the extension.
function showNotInShell() {
  document.body.innerHTML = `
    <div style="max-width:520px;margin:12vh auto;padding:24px;font-family:'Segoe UI',system-ui,sans-serif;color:#eef0f3;line-height:1.5">
      <h1 style="font-weight:600">Backdrop Rotator</h1>
      <p>This page runs inside the Backdrop Rotator extension for Microsoft Edge. Open a new tab, or click the
      Backdrop Rotator icon in the toolbar to open its settings.</p>
    </div>`;
  document.body.style.background = '#0f1115';
}
