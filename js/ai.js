// AI background generation: free (Pollinations) or OpenAI GPT Image, with optional text.
const AI = (() => {
  const STYLES = {
    cinematic: 'cinematic photograph, dramatic lighting, ultra detailed, high dynamic range',
    digital: 'highly detailed digital painting, epic concept art',
    anime: 'anime style illustration, vibrant colors, detailed background art',
    minimal: 'minimalist flat vector art, clean simple shapes, limited color palette',
    oil: 'classical oil painting, rich brush strokes',
    poster: 'bold vintage poster art, strong graphic shapes',
    scifi: 'sleek sci-fi concept art, futuristic, glowing details',
    none: ''
  };

  const FONTS = {
    'Bebas Neue': { weight: 400, spacing: 0.04 },
    'Black Ops One': { weight: 400, spacing: 0.02 },
    'Cinzel': { weight: 700, spacing: 0.06 },
    'Orbitron': { weight: 800, spacing: 0.05 },
    'Playfair Display': { weight: 700, spacing: 0.01 },
    'Permanent Marker': { weight: 400, spacing: 0.01 }
  };

  function buildPrompt(desc, style, aiText, overlayPos) {
    let p = desc.trim().replace(/\s+/g, ' ');
    if (STYLES[style]) p += `. Style: ${STYLES[style]}`;
    p += '. Widescreen 16:9 desktop wallpaper composition, no watermark, no border';
    if (aiText) {
      p += `. Prominently feature the exact text "${aiText}" as large, stylish, perfectly legible lettering ` +
           'that fits the scene. Spell it exactly as written, letter for letter.';
    } else if (overlayPos) {
      p += `. Leave clean open space in the ${overlayPos === 'center' ? 'middle' : overlayPos} of the image for a title. No text, no letters.`;
    } else {
      p += '. No text, no letters, no words';
    }
    return p;
  }

  let lastFree = 0;
  async function free(prompt) {
    const wait = 16000 - (Date.now() - lastFree);
    if (wait > 0) throw new Error(`The free generator allows one image every 15 seconds. Try again in ${Math.ceil(wait / 1000)}s.`);
    lastFree = Date.now();
    const seed = Math.floor(Math.random() * 1e9);
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
      `?width=1024&height=576&seed=${seed}&referrer=backdroprotator`;
    const r = await BR.webFetch(url, { responseType: 'blob', timeout: 150000 });
    if (r.status === 429) throw new Error('The free generator is busy. Wait a minute and try again.');
    if (!r.ok || !r.body || !r.body.type.startsWith('image/'))
      throw new Error(`The free generator didn't return an image (error ${r.status}). Try again or reword your description.`);
    return r.body;
  }

  async function openai(prompt, s) {
    if (!s.openaiKey) throw new Error('Add your OpenAI API key under "OpenAI settings" first.');
    const call = (size) => BR.webFetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.openaiKey },
      body: JSON.stringify({ model: s.openaiModel || 'gpt-image-2', prompt, size, quality: s.openaiQuality, n: 1 }),
      responseType: 'json',
      timeout: 240000
    });
    let r = await call('1536x1024');
    if (!r.ok && /size/i.test(JSON.stringify(r.body))) r = await call('auto');
    if (!r.ok) {
      const msg = (r.body && r.body.error && r.body.error.message) || `error ${r.status}`;
      if (r.status === 401) throw new Error('OpenAI rejected the API key. Check it under "OpenAI settings".');
      throw new Error('OpenAI: ' + msg);
    }
    const d = r.body.data && r.body.data[0];
    if (d && d.b64_json) return (await fetch('data:image/png;base64,' + d.b64_json)).blob();
    if (d && d.url) { const img = await BR.webFetch(d.url, { responseType: 'blob', timeout: 60000 }); return img.body; }
    throw new Error('OpenAI returned no image.');
  }

  async function drawText(ctx, W, H, text, fontName, pos) {
    const f = FONTS[fontName] || FONTS['Bebas Neue'];
    await document.fonts.load(`${f.weight} 100px "${fontName}"`).catch(() => {});
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    let size = Math.round(H * 0.17);
    const setFont = () => {
      ctx.font = `${f.weight} ${size}px "${fontName}", "Segoe UI", sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * f.spacing)}px`;
    };
    setFont();
    while (size > 14 && (Math.max(...lines.map((l) => ctx.measureText(l).width)) > W * 0.86 || lines.length * size * 1.1 > H * 0.62)) {
      size -= 2;
      setFont();
    }
    const lh = size * 1.1;
    const total = lh * lines.length;
    const y0 = pos === 'top' ? H * 0.1 : pos === 'bottom' ? H * 0.9 - total : (H - total) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = size * 0.3;
    ctx.shadowOffsetY = size * 0.04;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
    ctx.shadowColor = 'transparent';
  }

  // Resize (free images are upscaled to 1920x1080), add overlay text, and save as JPEG.
  async function finalize(blob, { text, font, pos, upscale }) {
    const bmp = await createImageBitmap(blob);
    const W = upscale ? 1920 : bmp.width;
    const H = upscale ? Math.round(1920 * bmp.height / bmp.width) : bmp.height;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, W, H);
    bmp.close();
    if (text) await drawText(ctx, W, H, text, font, pos);
    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  async function generate({ prompt, text, style, engine, textMode, font, pos }) {
    if (!prompt.trim()) throw new Error('Describe the background you want first.');
    const s = await BR.getSettings();
    text = (text || '').trim();
    const aiDrawsText = !!text && engine === 'openai' && textMode === 'ai';
    const full = buildPrompt(prompt, style, aiDrawsText ? text : '', text && !aiDrawsText ? pos : '');
    const raw = engine === 'openai' ? await openai(full, s) : await free(full);
    return finalize(raw, { text: aiDrawsText ? '' : text, font, pos, upscale: engine !== 'openai' });
  }

  return { STYLES, FONTS, generate };
})();
