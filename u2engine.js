// Tiny engine that runs the u2netp cutout model in plain JavaScript (no libraries, no WebAssembly).
// It supports exactly the operations that model uses. Input: the photo resized to 320x320.
// Output: a 320x320 map, 1 = subject, 0 = background.
const U2Cutout = (() => {
  let W = null;
  function weights() {
    if (W) return W;
    const bin = atob(self.U2NETP_W), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const h = new Uint16Array(u8.buffer);
    const f16 = (v) => { const s = v & 0x8000 ? -1 : 1, e = (v >> 10) & 31, m = v & 1023;
      return e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15); };
    const table = new Float32Array(65536); for (let i = 0; i < 65536; i++) table[i] = f16(i);
    W = {};
    for (const [name, t] of Object.entries(self.U2NETP_MODEL.w)) {
      if (t.t === 'f16') { const n = t.s.reduce((a, b) => a * b, 1), a = new Float32Array(n), o = t.o / 2; for (let i = 0; i < n; i++) a[i] = table[h[o + i]]; W[name] = { d: a, s: t.s }; }
      else W[name] = { i: t.v, s: t.s };
    }
    return W;
  }
  const ints = (t) => t.i ? t.i : Array.from(t.d);

  function conv(x, w, b, at) {
    const [, C, H, Wd] = x.s, [O, , KH, KW] = w.s;
    const [pt, pl] = at.pads || [0, 0], [dh, dw] = at.dilations || [1, 1], [sh, sw] = at.strides || [1, 1];
    if (sh !== 1 || sw !== 1 || (at.group || 1) !== 1) throw new Error('unsupported conv');
    const OH = H + 2 * pt - dh * (KH - 1), OW = Wd + 2 * pl - dw * (KW - 1), P = OH * OW;
    const out = new Float32Array(O * P), xi = x.d, wd = w.d, K = KH * KW, HW = H * Wd;
    // Row by row (keeps the working set in cache), four output channels at a time.
    for (let o = 0; o < O; o += 4) {
      const n = Math.min(4, O - o);
      const b0 = b ? b.d[o] : 0, b1 = b && n > 1 ? b.d[o + 1] : 0, b2 = b && n > 2 ? b.d[o + 2] : 0, b3 = b && n > 3 ? b.d[o + 3] : 0;
      const r0 = o * P, r1 = (o + (n > 1 ? 1 : 0)) * P, r2 = (o + (n > 2 ? 2 : 0)) * P, r3 = (o + (n > 3 ? 3 : 0)) * P;
      const ws = (oo) => (oo < n ? (o + oo) * C * K : -1);
      const w0 = ws(0), w1 = ws(1), w2 = ws(2), w3 = ws(3);
      for (let y = 0; y < OH; y++) {
        const q = y * OW;
        for (let xx = 0; xx < OW; xx++) { out[r0 + q + xx] = b0; if (n > 1) out[r1 + q + xx] = b1; if (n > 2) out[r2 + q + xx] = b2; if (n > 3) out[r3 + q + xx] = b3; }
        for (let ky = 0; ky < KH; ky++) {
          const iy = y + ky * dh - pt; if (iy < 0 || iy >= H) continue;
          for (let kx = 0; kx < KW; kx++) {
            const ox = kx * dw - pl, x0 = Math.max(0, -ox), x1 = Math.min(OW, Wd - ox), kk = ky * KW + kx;
            for (let c = 0; c < C; c++) {
              const ii = c * HW + iy * Wd + ox, wi = c * K + kk;
              const a0 = wd[w0 + wi], a1 = w1 >= 0 ? wd[w1 + wi] : 0, a2 = w2 >= 0 ? wd[w2 + wi] : 0, a3 = w3 >= 0 ? wd[w3 + wi] : 0;
              const o0 = r0 + q, o1 = r1 + q, o2 = r2 + q, o3 = r3 + q;
              if (n === 4) for (let xx = x0; xx < x1; xx++) { const v = xi[ii + xx]; out[o0 + xx] += a0 * v; out[o1 + xx] += a1 * v; out[o2 + xx] += a2 * v; out[o3 + xx] += a3 * v; }
              else for (let xx = x0; xx < x1; xx++) { const v = xi[ii + xx]; out[o0 + xx] += a0 * v; if (n > 1) out[o1 + xx] += a1 * v; if (n > 2) out[o2 + xx] += a2 * v; }
            }
          }
        }
      }
    }
    return { d: out, s: [1, O, OH, OW] };
  }
  function maxpool(x) {   // 2x2, stride 2, ceil mode
    const [, C, H, Wd] = x.s, OH = Math.ceil(H / 2), OW = Math.ceil(Wd / 2), out = new Float32Array(C * OH * OW);
    for (let c = 0; c < C; c++) for (let y = 0; y < OH; y++) for (let xx = 0; xx < OW; xx++) {
      let m = -Infinity;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const yy = 2 * y + dy, x2 = 2 * xx + dx; if (yy < H && x2 < Wd) { const v = x.d[(c * H + yy) * Wd + x2]; if (v > m) m = v; } }
      out[(c * OH + y) * OW + xx] = m;
    }
    return { d: out, s: [1, C, OH, OW] };
  }
  function resize(x, sizes) {   // bilinear, pytorch_half_pixel
    const [, C, H, Wd] = x.s, OH = sizes[2], OW = sizes[3], out = new Float32Array(C * OH * OW);
    const map = (o, n, N) => { if (n === 1) return [0, 0, 0]; let v = (o + 0.5) * N / n - 0.5; v = Math.max(0, Math.min(N - 1, v)); const a = Math.floor(v), b = Math.min(N - 1, a + 1); return [a, b, v - a]; };
    const ys = Array.from({ length: OH }, (_, i) => map(i, OH, H)), xs = Array.from({ length: OW }, (_, i) => map(i, OW, Wd));
    for (let c = 0; c < C; c++) {
      const b = c * H * Wd;
      for (let y = 0; y < OH; y++) {
        const [y0, y1, fy] = ys[y];
        for (let xx = 0; xx < OW; xx++) {
          const [x0, x1, fx] = xs[xx];
          const v00 = x.d[b + y0 * Wd + x0], v01 = x.d[b + y0 * Wd + x1], v10 = x.d[b + y1 * Wd + x0], v11 = x.d[b + y1 * Wd + x1];
          out[(c * OH + y) * OW + xx] = (v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy;
        }
      }
    }
    return { d: out, s: [1, C, OH, OW] };
  }
  function concat1(list) {
    const [, , H, Wd] = list[0].s, C = list.reduce((a, t) => a + t.s[1], 0), out = new Float32Array(C * H * Wd);
    let o = 0; for (const t of list) { out.set(t.d, o); o += t.d.length; }
    return { d: out, s: [1, C, H, Wd] };
  }


  // ---------- GPU path (WebGL2): tensors live in float textures, 4 channels per texel, channel groups stacked vertically ----------
  function makeGPU() {
    let gl;
    try {
      const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
      gl = cv.getContext('webgl2', { antialias: false, depth: false, preserveDrawingBuffer: false });
    } catch (e) { return null; }
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    const MAXT = gl.getParameter(gl.MAX_TEXTURE_SIZE), TW = 2048;
    const VS = '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
    const HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;out vec4 o;\n';
    const progs = {};
    function prog(name, body) {
      if (progs[name]) return progs[name];
      const mk = (t, src) => { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
      const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, HEAD + body)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return (progs[name] = { p, u });
    }
    // Layout: channel group l (4 channels) sits in a grid cell (l % COLS, l / COLS) of size W x H.
    const LIB = `uniform int IW,IH,IC,OW,OH,OC,OL;
ivec2 at(int l,int x,int y){return ivec2((l%IC)*IW+x,(l/IC)*IH+y);}
bool outpos(out int l,out int x,out int y){int gx=int(gl_FragCoord.x),gy=int(gl_FragCoord.y);int lx=gx/OW,ly=gy/OH;l=ly*OC+lx;x=gx-lx*OW;y=gy-ly*OH;return l<OL;}
`;
    const SH = {
      conv: LIB + `uniform sampler2D X,Wt,Bt;uniform int LC,K,DIL,PAD,TWD,RELU;
void main(){int ol,ox,oy;if(!outpos(ol,ox,oy)){o=vec4(0.0);return;}vec4 acc=texelFetch(Bt,ivec2(ol,0),0);int KK=K*K;
for(int cl=0;cl<LC;cl++){int base=(ol*LC+cl)*KK;for(int ky=0;ky<K;ky++){int iy=oy+ky*DIL-PAD;if(iy<0||iy>=IH)continue;
for(int kx=0;kx<K;kx++){int ix=ox+kx*DIL-PAD;if(ix<0||ix>=IW)continue;vec4 v=texelFetch(X,at(cl,ix,iy),0);int t=(base+ky*K+kx)*4;ivec2 q=ivec2(t%TWD,t/TWD);
acc+=mat4(texelFetch(Wt,q,0),texelFetch(Wt,q+ivec2(1,0),0),texelFetch(Wt,q+ivec2(2,0),0),texelFetch(Wt,q+ivec2(3,0),0))*v;}}}
o=RELU==1?max(acc,0.0):acc;}`,
      relu: LIB + `uniform sampler2D X;void main(){int l,x,y;if(!outpos(l,x,y)){o=vec4(0.0);return;}o=max(texelFetch(X,at(l,x,y),0),0.0);}`,
      add: LIB + `uniform sampler2D X,Y;void main(){int l,x,y;if(!outpos(l,x,y)){o=vec4(0.0);return;}ivec2 p=at(l,x,y);o=texelFetch(X,p,0)+texelFetch(Y,p,0);}`,
      pool: LIB + `uniform sampler2D X;void main(){int l,ox,oy;if(!outpos(l,ox,oy)){o=vec4(0.0);return;}vec4 m=vec4(-1e30);
for(int dy=0;dy<2;dy++)for(int dx=0;dx<2;dx++){int y=2*oy+dy,x=2*ox+dx;if(y<IH&&x<IW)m=max(m,texelFetch(X,at(l,x,y),0));}o=m;}`,
      resize: LIB + `uniform sampler2D X;
float mp(int o,int n,int N){if(n==1)return 0.0;return clamp((float(o)+0.5)*float(N)/float(n)-0.5,0.0,float(N-1));}
void main(){int l,ox,oy;if(!outpos(l,ox,oy)){o=vec4(0.0);return;}float fy=mp(oy,OH,IH),fx=mp(ox,OW,IW);
int y0=int(floor(fy)),x0=int(floor(fx));int y1=min(IH-1,y0+1),x1=min(IW-1,x0+1);float ay=fy-float(y0),ax=fx-float(x0);
o=mix(mix(texelFetch(X,at(l,x0,y0),0),texelFetch(X,at(l,x1,y0),0),ax),mix(texelFetch(X,at(l,x0,y1),0),texelFetch(X,at(l,x1,y1),0),ax),ay);}`,
      copy: LIB + `uniform sampler2D X;uniform int OFF,LN;void main(){int l,x,y;if(!outpos(l,x,y)||l<OFF||l>=OFF+LN)discard;o=texelFetch(X,at(l-OFF,x,y),0);}`
    };
    const vao = gl.createVertexArray();
    function tex(w, h, data) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
      for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);
      for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
      return t;
    }
    function tensor(C, H, W) {
      const L = Math.ceil(C / 4), per = Math.max(1, Math.floor(MAXT / H)), cols = Math.ceil(L / per), rows = Math.ceil(L / cols);
      if (cols * W > MAXT || rows * H > MAXT) throw new Error('too big');
      const t = tex(cols * W, rows * H), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { g: { t, fb, L, H, W, cols, rows }, s: [1, C, H, W] };
    }
    const pos = (t, l, x, y) => [(l % t.g.cols) * t.g.W + x, Math.floor(l / t.g.cols) * t.g.H + y];
    function draw(name, out, inputs, ints, src) {
      const P = prog(name, SH[name]); gl.useProgram(P.p); gl.bindVertexArray(vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.g.fb); gl.viewport(0, 0, out.g.cols * out.g.W, out.g.rows * out.g.H);
      Object.entries(inputs).forEach(([k, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.u[k], i); });
      const S = src || out;
      const all = Object.assign({ IW: S.g.W, IH: S.g.H, IC: S.g.cols, OW: out.g.W, OH: out.g.H, OC: out.g.cols, OL: out.g.L }, ints);
      for (const [k, val] of Object.entries(all)) if (P.u[k]) gl.uniform1i(P.u[k], val);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function upload(t) {   // CPU tensor -> GPU
      const [, C, H, W] = t.s, out = tensor(C, H, W), TWi = out.g.cols * W, buf = new Float32Array(TWi * out.g.rows * H * 4);
      for (let c = 0; c < C; c++) { const l = c >> 2, k = c & 3; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [px, py] = pos(out, l, x, y); buf[(py * TWi + px) * 4 + k] = t.d[(c * H + y) * W + x]; } }
      gl.bindTexture(gl.TEXTURE_2D, out.g.t); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TWi, out.g.rows * H, gl.RGBA, gl.FLOAT, buf);
      return out;
    }
    function download(t) {   // GPU tensor -> CPU
      const [, C, H, W] = t.s, TWi = t.g.cols * W, buf = new Float32Array(TWi * t.g.rows * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.g.fb); gl.readPixels(0, 0, TWi, t.g.rows * H, gl.RGBA, gl.FLOAT, buf);
      const d = new Float32Array(C * H * W);
      for (let c = 0; c < C; c++) { const l = c >> 2, k = c & 3; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [px, py] = pos(t, l, x, y); d[(c * H + y) * W + x] = buf[(py * TWi + px) * 4 + k]; } }
      return { d, s: t.s };
    }
    const wcache = new Map();
    function convW(w, b) {
      if (wcache.has(w)) return wcache.get(w);
      const [O, C, KH, KW] = w.s, LO = Math.ceil(O / 4), LC = Math.ceil(C / 4), KK = KH * KW, n = LO * LC * KK * 4;
      const rows = Math.ceil(n / TW), buf = new Float32Array(TW * rows * 4);
      for (let ol = 0; ol < LO; ol++) for (let cl = 0; cl < LC; cl++) for (let tap = 0; tap < KK; tap++) for (let c = 0; c < 4; c++) {
        const ic = cl * 4 + c, texel = ((ol * LC + cl) * KK + tap) * 4 + c; if (ic >= C) continue;
        for (let k = 0; k < 4; k++) { const oc = ol * 4 + k; if (oc < O) buf[texel * 4 + k] = w.d[(oc * C + ic) * KK + tap]; }
      }
      const bb = new Float32Array(LO * 4); if (b) bb.set(b.d);
      const r = { wt: tex(TW, rows, buf), bt: tex(LO, 1, bb) }; wcache.set(w, r); return r;
    }
    function conv(x, w, b, at, relu) {
      const [, C, H, W] = x.s, [O, , KH] = w.s, pad = (at.pads || [0])[0], dil = (at.dilations || [1])[0];
      const OH = H + 2 * pad - dil * (KH - 1), OW = W + 2 * pad - dil * (KH - 1), out = tensor(O, OH, OW), cw = convW(w, b);
      draw('conv', out, { X: x.g.t, Wt: cw.wt, Bt: cw.bt }, { LC: Math.ceil(C / 4), K: KH, DIL: dil, PAD: pad, TWD: TW, RELU: relu ? 1 : 0 }, x);
      return out;
    }
    function unary(name, x, extra, OHW) {
      const [, C, H, W] = x.s, [OH, OW] = OHW || [H, W], out = tensor(C, OH, OW);
      draw(name, out, { X: x.g.t }, extra || {}, x); return out;
    }
    function add(a, b) { const out = tensor(a.s[1], a.s[2], a.s[3]); draw('add', out, { X: a.g.t, Y: b.g.t }, {}, a); return out; }
    function concat(list) {
      const [, , H, W] = list[0].s, out = tensor(list.reduce((s, t) => s + t.s[1], 0), H, W); let off = 0;
      for (const t of list) { draw('copy', out, { X: t.g.t }, { OFF: off, LN: t.g.L }, t); off += t.g.L; }
      return out;
    }
    function free(t) { if (t && t.g) { gl.deleteTexture(t.g.t); gl.deleteFramebuffer(t.g.fb); t.g = null; } }
    function finish() { gl.finish(); }
    return { conv, unary, add, concat, upload, download, free, finish };
  }
  let GPU; const info = { path: '' };
  const gpu = () => (GPU === undefined ? (GPU = (() => { try { return makeGPU(); } catch (e) { return null; } })()) : GPU);

  // input: Float32Array of 3*320*320 (normalised RGB planes). Returns Float32Array 320*320.
  async function run(input, onProgress, size = 320, useGPU = true) {
    const w = weights(), M = self.U2NETP_MODEL, env = Object.assign({}, w);
    const G = useGPU ? gpu() : null;
    try { const r = await exec(G); info.path = G ? 'gpu' : 'cpu'; return r; }
    catch (e) { if (!G) throw e; info.path = 'cpu (gpu failed: ' + e.message + ')'; return exec(null); }   // GPU trouble: redo it on the processor
    async function exec(G) {
      const env = Object.assign({}, w), last = {};
      M.nodes.forEach(([, ins], i) => ins.forEach((k) => { last[k] = i; }));
      env[M.input] = { d: input, s: [1, 3, size, size] };
      const cpu = (t) => (t && t.g ? G.download(t) : t), onGPU = (t) => (t && t.g ? t : G.upload(t));
      let n = 0;
      for (let ni = 0; ni < M.nodes.length; ni++) {
        const [op, ins, outs, at] = M.nodes[ni];
        let I = ins.map((k) => (k === '' ? null : env[k]));
        let r;
        const nextRelu = G && op === 'Conv' && M.nodes[ni + 1] && M.nodes[ni + 1][0] === 'Relu' && M.nodes[ni + 1][1][0] === outs[0] && last[outs[0]] === ni + 1;
        if (G && op === 'Conv') { r = G.conv(onGPU(I[0]), I[1], I[2], at, nextRelu); }
        else if (G && op === 'Relu' && I[0].g) r = G.unary('relu', I[0]);
        else if (G && op === 'Add' && I[0].g && I[1].g) r = G.add(I[0], I[1]);
        else if (G && op === 'MaxPool' && I[0].g) r = G.unary('pool', I[0], null, [Math.ceil(I[0].s[2] / 2), Math.ceil(I[0].s[3] / 2)]);
        else if (G && op === 'Resize' && I[0].g) { const sz = ints(I[3]); r = G.unary('resize', I[0], null, [sz[2], sz[3]]); }
        else if (G && op === 'Concat' && at.axis === 1 && I.every((t) => t.g && t.s[1] % 4 === 0)) r = G.concat(I);
        else {
          if (G && ['Relu', 'Add', 'Sigmoid', 'MaxPool', 'Resize', 'Concat'].includes(op)) I = I.map(cpu);
          switch (op) {
            case 'Conv': r = conv(I[0], I[1], I[2], at); break;
            case 'Relu': { const d = new Float32Array(I[0].d.length); for (let i = 0; i < d.length; i++) d[i] = I[0].d[i] > 0 ? I[0].d[i] : 0; r = { d, s: I[0].s }; break; }
            case 'Add': { const d = new Float32Array(I[0].d.length); for (let i = 0; i < d.length; i++) d[i] = I[0].d[i] + I[1].d[i]; r = { d, s: I[0].s }; break; }
            case 'Sigmoid': { const d = new Float32Array(I[0].d.length); for (let i = 0; i < d.length; i++) d[i] = 1 / (1 + Math.exp(-I[0].d[i])); r = { d, s: I[0].s }; break; }
            case 'MaxPool': r = maxpool(I[0]); break;
            case 'Resize': r = resize(I[0], ints(I[3])); break;
            case 'Concat': r = at.axis === 1 ? concat1(I) : { i: I.flatMap(ints), s: [] }; break;
            case 'Constant': r = { i: at.value.v, s: at.value.s }; break;
            case 'Shape': r = { i: I[0].s.slice(), s: [4] }; break;
            case 'Gather': { const d = ints(I[0]), idx = ints(I[1]); r = { i: idx.map((j) => d[j < 0 ? j + d.length : j]), s: I[1].s }; break; }
            case 'Unsqueeze': case 'Cast': r = { i: ints(I[0]), s: [ints(I[0]).length] }; break;
            case 'Slice': { const d = ints(I[0]); let s0 = ints(I[1])[0], e0 = ints(I[2])[0]; if (s0 < 0) s0 += d.length; if (e0 < 0) e0 += d.length; r = { i: d.slice(Math.max(0, s0), Math.min(d.length, e0)), s: [] }; break; }
            default: throw new Error('op ' + op);
          }
        }
        if (nextRelu) { env[outs[0]] = r; env[M.nodes[ni + 1][2][0]] = r; ni++; }
        else env[outs[0]] = r;
        const outName = nextRelu ? M.nodes[ni][2][0] : outs[0];
        if (outName === M.output) { const res = cpu(r).d; for (const v of Object.values(env)) if (v && v.g) G.free(v); return res; }
        // Free GPU tensors nobody needs any more.
        if (G) for (const k of ins) if (last[k] <= ni && env[k] && env[k].g && env[k] !== r && !w[k]) { G.free(env[k]); }
        if (op === 'Conv' && ++n % (G ? 20 : 6) === 0) { if (onProgress) onProgress(n / 119); if (G) G.finish(); await new Promise((res) => setTimeout(res, 0)); }
      }
      throw new Error('no output');
    }
  }

  // Cut out the main subject of an image (HTMLImageElement or canvas). Returns { mask: Float32Array(320*320) }.
  async function cutout(img, onProgress) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 320;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 320, 320);
    const px = g.getImageData(0, 0, 320, 320).data, N = 320 * 320;
    let mx = 1e-6; for (let i = 0; i < N; i++) mx = Math.max(mx, px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225], x = new Float32Array(3 * N);
    for (let ch = 0; ch < 3; ch++) for (let i = 0; i < N; i++) x[ch * N + i] = (px[i * 4 + ch] / mx - mean[ch]) / std[ch];
    return { mask: await run(x, onProgress) };
  }
  return { run, cutout, hasGPU: () => !!gpu(), info };
})();
