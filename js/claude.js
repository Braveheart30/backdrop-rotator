// "Sketch anything with Claude": asks Claude to draw a subject as a few clean vector lines,
// always in the app's single minimal style (the app applies the colors and glow, so it can't go off theme).
// Uses the user's own Anthropic API key. The reply is strictly checked before anything is drawn.
const ClaudeSketch = (() => {
  const API = 'https://api.anthropic.com/v1/messages';
  const MODELS = {
    'claude-sonnet-5-5': 'Claude Sonnet 5.5 (best drawings, about 2¢ each)',
    'claude-haiku-5-5': 'Claude Haiku 5.5 (cheapest and fastest)',
    'claude-opus-5-5': 'Claude Opus 5.5 (most careful, costs most)'
  };
  const MIN_SHELL = [2, 2, 0];

  const SYSTEM = `You draw minimalist line-art icons for a calm desktop wallpaper, in the spirit of Apple's simple product line drawings.

The user describes what they want, possibly with extra wishes (words to show, a mood, a detail to include).
Draw the main subject as a recognizable silhouette made of a FEW clean, single-weight strokes:
- Use the most recognizable view (usually side profile for vehicles, ships and animals; front or 3/4 for buildings).
- 3 to 10 strokes total. Capture the essential shape only: outline plus at most a few defining details. No shading, hatching, texture, people, text, letters, numbers, logos, flags or brand marks. If the subject is a brand or franchise, draw the generic object it is (e.g. "Disney cruise" -> a classic cruise ship), never its logo or characters.
- Coordinates: a canvas 600 wide and between 160 and 280 tall. Keep everything inside it with a little margin. Center the subject.
- Path data may only use the commands M L H V C S Q T A Z (absolute, uppercase) with plain numbers. Keep each path under 1500 characters.
- Optionally add 1 or 2 faint ground/horizon/water lines (these may extend from x=-200 to x=800).
- Never draw letters with strokes. If the user asks for words, a motto, a name or a caption, put that text (24 characters max) in "text" and the app will set it in clean lettering. Otherwise use "".
- Ignore requests for colors, photos, shading or realism: the app's single minimal style always applies.

Reply with ONLY a JSON object, no prose, no code fences:
{"name": "Short Title Case name", "text": "", "size": [600, H], "paths": ["M ..."], "circles": [[cx, cy, r]], "faint": ["M ..."]}`;

  const num = (x) => typeof x === 'number' && isFinite(x);
  const PATH_OK = /^[MLHVCSQTAZ0-9.,\s-]+$/;

  // Accept only well-formed, simple vector data. Anything else is rejected.
  function validate(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('bad');
    const size = Array.isArray(obj.size) && obj.size.length === 2 && obj.size.every(num) ? obj.size : [600, 230];
    const w = Math.min(Math.max(size[0], 200), 800), h = Math.min(Math.max(size[1], 120), 400);
    const cleanPaths = (arr, max) => (Array.isArray(arr) ? arr : [])
      .filter((d) => typeof d === 'string' && d.length > 3 && d.length <= 1500 && PATH_OK.test(d.trim()) && /^\s*M/.test(d))
      .slice(0, max).map((d) => d.trim().replace(/\s+/g, ' '));
    const paths = cleanPaths(obj.paths, 14);
    const faint = cleanPaths(obj.faint, 3);
    const circles = (Array.isArray(obj.circles) ? obj.circles : [])
      .filter((c) => Array.isArray(c) && c.length === 3 && c.every(num) && c[2] > 0 && c[2] < 400).slice(0, 8)
      .map((c) => c.map((v) => Math.round(v * 10) / 10));
    if (!paths.length && !circles.length) throw new Error('empty');
    const name = String(obj.name || '').replace(/[^\p{L}\p{N} '&-]/gu, '').trim().slice(0, 40) || 'Sketch';
    const text = Sketch.cleanText(obj.text);
    return { name, text, size: [w, h], paths, circles, faint };
  }

  function parseReply(text) {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    return validate(JSON.parse(m[0]));
  }

  const vnum = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0);
  function shellOk(v) {
    const a = vnum(v);
    for (let i = 0; i < 3; i++) { if (a[i] > MIN_SHELL[i]) return true; if (a[i] < MIN_SHELL[i]) return false; }
    return true;
  }

  async function draw(subject) {
    subject = String(subject || '').trim().slice(0, 200);
    if (!subject) throw new Error('Type something for Claude to sketch first.');
    const info = await Bridge.call('info').catch(() => ({}));
    // Older extensions (before 2.2.0) have no separate Claude switch; their general
    // web-access switch covers Claude instead, and the emergency stop still works.
    const oldShell = !shellOk(info.shellVersion);
    const s = await BR.getSettings();
    if (!s.claudeKey) throw new Error('Add your Anthropic API key under "Claude settings" first.');
    const today = new Date().toDateString();
    const made = s.aiDay && s.aiDay.d === today ? s.aiDay.n : 0;
    if (s.eco && made >= BR.ECO.aiPerDay) {
      throw new Error(`Eco mode limit reached: ${BR.ECO.aiPerDay} AI creations per day. Turn off Eco mode to make more today.`);
    }
    const model = s.eco ? 'claude-haiku-5-5' : (s.claudeModel || 'claude-sonnet-5-5');
    const ask = async (extra) => {
      const r = await BR.webFetch(API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': s.claudeKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model, max_tokens: s.eco ? 1500 : 2500, system: SYSTEM,
          messages: [{ role: 'user', content: `Sketch request: ${subject}${extra || ''}` }]
        }),
        responseType: 'json',
        timeout: 120000
      });
      if (!r.ok) {
        const msg = (r.body && r.body.error && r.body.error.message) || `error ${r.status}`;
        if (r.status === 401) throw new Error('Anthropic rejected the API key. Check it under "Claude settings".');
        if (r.status === 429) throw new Error('Claude is busy or your account hit its rate limit. Try again in a minute.');
        throw new Error('Claude: ' + msg);
      }
      const text = ((r.body && r.body.content) || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      return parseReply(text);
    };
    let result;
    try { result = await ask(); }
    catch (e) {
      if (oldShell && /Blocked/.test(e.message)) throw new Error(e.message + ' (On this version of the extension, that switch also controls Claude.)');
      if (/^(Claude|Anthropic)/.test(e.message) || /Blocked|stopped/.test(e.message)) throw e;
      result = await ask('\n\n(Your last reply could not be read. Reply with only the JSON object.)').catch(() => {
        throw new Error("Claude's drawing didn't come out right. Try again, or describe the subject a little differently.");
      });
    }
    await BR.saveSettings({ aiDay: { d: today, n: made + 1 } });
    return { ...result, id: 'c' + Date.now().toString(36), prompt: subject, model };
  }

  // Free route: the message to paste into a regular Claude chat (no API key needed).
  function chatPrompt(subject) {
    subject = String(subject || '').trim().slice(0, 200);
    return SYSTEM + '\n\nSketch request: ' + subject;
  }
  function fromPaste(text) {
    try { return parseReply(String(text || '')); }
    catch (e) { throw new Error("That doesn't look like a drawing from Claude. Copy Claude's whole reply (the part in { } braces) and paste it again."); }
  }

  return { MODELS, draw, validate, shellOk, chatPrompt, fromPaste };
})();
