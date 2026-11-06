// Keilverschluss – Oberfläche
(() => {
  const C = { bg: '#0B0B0B', fg: '#EDEDEA', mu: '#7C7B77', hl: '#2B2B29', rule: '#3A3A38', grid: '#1E1E1D', back: '#3C3C3A', line: '#CFCFCB' };
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);

  // ---------- Farbe (OKLab) ----------
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const delin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055);
  const toLab = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const fromLab = ([L, A, B]) => {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return '#' + rgb.map((v) => Math.round(Math.min(Math.max(delin(v), 0), 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const ST = ['#7A828A', '#5F8B8E', '#8E8A6A', '#B0502F'].map(toLab);
  const ramp = (t) => {
    t = Math.min(Math.max(t, 0), 1);
    const n = ST.length - 1, i = Math.min(Math.floor(t * n), n - 1), f = t * n - i;
    return fromLab(ST[i].map((v, k) => v * (1 - f) + ST[i + 1][k] * f));
  };
  const darker = (h, k = 0.8) => { const L = toLab(h); L[0] *= k; return fromLab(L); };
  const POS = [[0, 0], [13.85, 0.36], [15, 0.62], [30, 1]];
  const colfor = (a) => {
    for (let i = 0; i < POS.length - 1; i++) {
      const [a0, p0] = POS[i], [a1, p1] = POS[i + 1];
      if (a >= a0 && a <= a1) return ramp(p0 + (p1 - p0) * (a - a0) / (a1 - a0));
    }
    return ramp(1);
  };
  const L300 = Math.log10(300), L5000 = Math.log10(5000);
  const rcol = (r) => ramp((L5000 - Math.log10(Math.min(Math.max(r, 300), 5000))) / (L5000 - L300));

  // ---------- Format ----------
  const NB = ' ';
  const fmt = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const fd = (a) => String(Math.round(a * 100) / 100).replace('.', ',') + '°';
  const pairTxt = (g) => g.pairs.map((p) => `${fd(p.hi)} / ${fd(p.lo)}`).join('  ·  ');
  const pairShort = (g) => `${fd(g.rep.hi)} / ${fd(g.rep.lo)}` + (g.pairs.length > 1 ? `  +${g.pairs.length - 1}` : '');

  // ---------- SVG-Helfer ----------
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const txt = (p, x, y, s, size, fill = C.fg, anchor = 'start', extra = {}) => { const e = el('text', { x, y, 'font-size': size, fill, 'text-anchor': anchor, 'font-family': 'Inter, Helvetica, Arial, sans-serif', ...extra }, p); e.textContent = s; return e; };
  const ln = (p, x1, y1, x2, y2, stroke, sw = 1, extra = {}) => el('line', { x1, y1, x2, y2, stroke, 'stroke-width': sw, ...extra }, p);
  const pts = (arr) => arr.map(([x, y]) => `${(-x).toFixed(2)},${y.toFixed(2)}`).join(' ');
  const hatchDef = (defs, id, w, sw) => {
    const pat = el('pattern', { id, width: w, height: w, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    ln(pat, 0, 0, 0, w, C.bg, sw);
  };
  const swatch = (color, hatched) => {
    const s = el('svg', { width: 18, height: 18, viewBox: '0 0 18 18', class: 'sw', 'aria-hidden': 'true' });
    el('rect', { width: 18, height: 18, fill: color }, s);
    if (hatched) for (let k = -18; k < 18; k += 7) ln(s, k, 18, k + 18, 0, C.bg, 2.6);
    return s;
  };

  // ---------- Zustand ----------
  const S = { exist: [0, 15, 30], added: [], bmin: 20, bmax: 40, tlo: 1000, thi: 2000, step: 0.5, nmax: 3, amin: 10, amax: 20, variants: null, fb: null, opt: null };
  try {
    const st = JSON.parse(localStorage.getItem('kv-state') || 'null');
    if (st && Array.isArray(st.exist)) Object.assign(S, { exist: st.exist, added: st.added || [], bmin: st.bmin ?? 20, bmax: st.bmax ?? 40, tlo: st.tlo ?? 1000, thi: st.thi ?? 2000, step: st.step ?? 0.5, nmax: st.nmax ?? 3, amin: st.amin ?? 10, amax: st.amax ?? 20 });
  } catch (e) { /* ohne Speicher */ }
  const save = () => { try { localStorage.setItem('kv-state', JSON.stringify({ exist: S.exist, added: S.added, bmin: S.bmin, bmax: S.bmax, tlo: S.tlo, thi: S.thi, step: S.step, nmax: S.nmax, amin: S.amin, amax: S.amax })); } catch (e) { /* egal */ } };
  const sameSet = (a, b) => { const x = KV.uniq(a), y = KV.uniq(b); return x.length === y.length && x.every((v, i) => v === y[i]); };

  // ---------- Vorgaben ----------
  const bwLo = $('bw-lo'), bwHi = $('bw-hi');
  bwLo.value = S.bmin; bwHi.value = S.bmax;
  const renderWidth = () => {
    const lo = +bwLo.min, hi = +bwLo.max;
    zOrder(bwLo, bwHi);
    $('bw-val').textContent = `${S.bmin} – ${S.bmax} mm`;
    const f = $('bw-fill');
    f.style.left = ((S.bmin - lo) / (hi - lo) * 100) + '%';
    f.style.width = ((S.bmax - S.bmin) / (hi - lo) * 100) + '%';
  };
  const onWidth = (which) => {
    let a = +bwLo.value, b = +bwHi.value;
    if (a > b - 1) { if (which === 'lo') a = b - 1; else b = a + 1; bwLo.value = a; bwHi.value = b; }
    S.bmin = a; S.bmax = b; S.variants = null; cancelJob(); save(); renderWidth(); renderAll();
  };
  bwLo.addEventListener('input', () => onWidth('lo'));
  bwHi.addEventListener('input', () => onWidth('hi'));

  const renderDetail = () => {
    const W = 480, Hh = 190, sc = 9, cx = 238, by = 140;
    const s = el('svg', { viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': 'Detail: Deckschicht mit Lamelle, Lamellenbreite an der Lamellenoberseite, Flankenwinkel' });
    const defs = el('defs', {}, s);
    const pat = el('pattern', { id: 'dHatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    ln(pat, 0, 0, 0, 6, '#4A4A47', 1);
    const P = (x, y) => [cx + x * sc, by - y * sc];
    const poly = (q) => el('polygon', { points: q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), fill: 'url(#dHatch)', stroke: C.line, 'stroke-width': 1 }, s);
    const a = 15 * Math.PI / 180, h = 8, hb = 1.2, tw = 11, bw = tw - Math.tan(a) * h;
    poly([P(-17, 0), P(17, 0), P(17, -hb), P(-17, -hb)]);
    poly([P(-bw, 0), P(bw, 0), P(tw, h), P(-tw, h)]);
    const [xa, ya] = P(-16, h / 2), [xb, yb] = P(16, h / 2);
    ln(s, xa, ya, xb, yb, C.mu, 0.8, { 'stroke-dasharray': '8 3 2 3' });
    txt(s, xa - 8, ya + 5, 'Mittelachse', 13, C.mu, 'end');
    const l1 = P(-tw, h), r1 = P(tw, h), yd = P(0, h + 3.5)[1];
    for (const [x, y] of [l1, r1]) ln(s, x, y - 4, x, yd - 6, C.mu, 0.8);
    ln(s, l1[0], yd, r1[0], yd, C.line, 1);
    for (const x of [l1[0], r1[0]]) ln(s, x - 4, yd + 4, x + 4, yd - 4, C.line, 1.2);
    txt(s, cx, yd - 10, 'Lamellenbreite', 15, C.fg, 'middle');
    const [bx, byy] = P(bw, 0), [tx, ty] = P(bw, h + 1);
    ln(s, bx, byy, tx, ty, C.mu, 0.8, { 'stroke-dasharray': '3 3' });
    const rr = 6 * sc, fx = bx + rr * Math.sin(a), fy = byy - rr * Math.cos(a);
    el('path', { d: `M ${bx} ${byy - rr} A ${rr} ${rr} 0 0 1 ${fx.toFixed(1)} ${fy.toFixed(1)}`, fill: 'none', stroke: C.line, 'stroke-width': 1 }, s);
    txt(s, fx + 22, fy + 8, 'Flankenwinkel', 13);
    txt(s, P(17, 0)[0] + 10, P(0, -hb / 2)[1] + 5, 'Deckschicht', 13, C.mu);
    const [lx, ly] = P(-(bw + (tw - bw) * 0.8) - 0.3, h * 0.8);
    ln(s, lx, ly, lx - 40, ly, C.mu, 0.8);
    txt(s, lx - 46, ly + 5, 'Lamelle', 13, C.mu, 'end');
    $('detail').replaceChildren(s);
    $('detail-tip').replaceChildren(s.cloneNode(true));
  };

  // ---------- Fräser ----------
  const addCut = (list, v) => {
    // Ergänzungen im Raster, vorhandene Fräser frei (auf 0,01°)
    v = list === 'added' ? Math.round(Math.round(v / S.step) * S.step * 100) / 100 : Math.round(v * 100) / 100;
    if (!isFinite(v) || v < 0 || v > 32) return false;
    if (S[list].includes(v)) return false;
    if (list === 'exist' && S.added.includes(v)) S.added = S.added.filter((q) => q !== v);
    else if (S.exist.includes(v)) return false;
    S[list] = KV.uniq([...S[list], v]);
    return true;
  };
  const chipRow = (box, list, hatched) => {
    box.replaceChildren();
    for (const c of S[list]) {
      const ch = document.createElement('span'); ch.className = 'chip';
      ch.appendChild(swatch(colfor(c), hatched));
      const v = document.createElement('span'); v.className = 'v'; v.textContent = fd(c); ch.appendChild(v);
      const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `${fd(c)} entfernen`);
      x.addEventListener('click', () => { S[list] = S[list].filter((q) => q !== c); if (list === 'exist') { S.variants = null; cancelJob(); } save(); renderAll(); });
      ch.appendChild(x);
      box.appendChild(ch);
    }
    const add = document.createElement('button'); add.className = 'add'; add.type = 'button'; add.innerHTML = '+<span class="t"> Fräser</span>'; add.setAttribute('aria-label', 'Fräser hinzufügen');
    add.addEventListener('click', () => {
      const f = document.createElement('span'); f.className = 'addform';
      const i = document.createElement('input'); i.type = 'text'; i.inputMode = 'decimal'; i.placeholder = '°'; i.setAttribute('aria-label', 'Flankenwinkel in Grad');
      f.appendChild(i);
      add.replaceWith(f); i.focus();
      let done = false;
      const okb = document.createElement('button'); okb.type = 'button'; okb.className = 'okb'; okb.textContent = 'OK'; f.appendChild(okb);
      const hint = document.createElement('span'); hint.className = 'small'; f.appendChild(hint);
      let okDown = false;
      okb.addEventListener('pointerdown', (e) => { okDown = true; e.preventDefault(); });
      okb.addEventListener('click', () => { okDown = false; commit(true, false); i.focus(); });
      const commit = (ok, fromBlur) => {
        if (done) return;
        const raw = i.value.trim();
        if (ok && raw !== '') {
          const okNum = /^\d+([.,]\d+)?$/.test(raw);
          const v = okNum ? parseFloat(raw.replace(',', '.')) : NaN;
          if (v >= 0 && v <= 32 && addCut(list, v)) { done = true; if (list === 'exist') { S.variants = null; cancelJob(); } save(); renderAll(); return; }
          if (!fromBlur) {
            hint.textContent = !isFinite(v) ? 'Zahl eingeben' : (v < 0 || v > 32) ? '0 bis 32°' : 'schon vorhanden';
            i.select(); return;
          }
        }
        done = true; chipRow(box, list, hatched);
      };
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(true, false); if (e.key === 'Escape') commit(false, false); });
      i.addEventListener('blur', () => setTimeout(() => { if (!okDown && document.activeElement !== i) commit(true, true); }, 150));
    });
    box.appendChild(add);
  };

  // ---------- Zielradius und Optimierung ----------
  const tLo = $('t-lo'), tHi = $('t-hi');
  tLo.value = S.tlo; tHi.value = S.thi;
  // liegt der linke Griff in der rechten Hälfte, kommt er nach oben
  const zOrder = (lo, hi) => { const top = +lo.value > (+lo.min + +lo.max) / 2; lo.style.zIndex = top ? 2 : 1; hi.style.zIndex = top ? 1 : 2; };
  const aLo = $('a-lo'), aHi = $('a-hi');
  const renderAngles = () => {
    zOrder(aLo, aHi);
    $('a-val').textContent = `${fd(S.amin)} – ${fd(S.amax)}`;
    $('a-fill').style.left = (S.amin / 32 * 100) + '%';
    $('a-fill').style.width = ((S.amax - S.amin) / 32 * 100) + '%';
  };
  const onAngle = (which) => {
    let lo = +aLo.value, hi = +aHi.value;
    if (lo > hi - 0.5) { if (which === 'lo') lo = hi - 0.5; else hi = lo + 0.5; aLo.value = lo; aHi.value = hi; }
    S.amin = lo; S.amax = hi; S.variants = null; cancelJob(); save(); renderAngles(); renderAll();
  };
  aLo.addEventListener('input', () => onAngle('lo'));
  aHi.addEventListener('input', () => onAngle('hi'));
  const renderTarget = () => {
    zOrder(tLo, tHi);
    const mn = +tLo.min, mx = +tLo.max;
    $('t-val').textContent = `R ${fmt(S.tlo)} – ${fmt(S.thi)} mm`;
    $('t-fill').style.left = ((S.tlo - mn) / (mx - mn) * 100) + '%';
    $('t-fill').style.width = ((S.thi - S.tlo) / (mx - mn) * 100) + '%';
  };
  const onTarget = (which) => {
    let lo = +tLo.value, hi = +tHi.value;
    if (lo > hi - 10) { if (which === 'lo') lo = hi - 10; else hi = lo + 10; tLo.value = lo; tHi.value = hi; }
    S.tlo = lo; S.thi = hi; S.variants = null; cancelJob(); save(); renderTarget(); renderAll();
  };
  tLo.addEventListener('input', () => onTarget('lo'));
  tHi.addEventListener('input', () => onTarget('hi'));
  // Rechnung im Hintergrund (Web Worker), damit die Seite nicht einfriert; Fallback ohne Worker
  let worker = null, job = 0, running = null, noWorker = false, lastMsg = null;
  const optBtn = $('opt');
  const makeWorker = () => {
    try {
      const src = `const KV = (${KVF.toString()})();
self.onmessage = (e) => {
  const d = e.data, o = { step: d.step, amin: d.amin, amax: d.amax };
  if (d.kind === 'opt') {
    const res = KV.optimize(d.exist, d.tlo, d.thi, d.bmin, d.bmax, { ...o, nmax: d.nmax, seeds: d.seeds, onStep: (r, n) => self.postMessage({ id: d.id, kind: 'opt', n, r }) });
    const last = res.results[res.results.length - 1];
    if (res.results.length && last.cov < 1) {
      self.postMessage({ id: d.id, kind: 'opt', needWide: true });
      self.postMessage({ id: d.id, kind: 'opt', wide: KV.widen(d.exist, d.tlo, d.thi, d.bmin, d.bmax, { ...o, maxN: d.nmax }) });
    }
    self.postMessage({ id: d.id, kind: 'opt', done: true });
    return;
  }
};`;
      return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) { return null; }
  };
  const busy = (kind) => {
    running = kind;
    optBtn.disabled = kind !== null;
    optBtn.textContent = kind === 'opt' ? 'rechnet …' : 'Optimieren';
  };
  const onResult = (d) => {
    if (d.id !== job) return;
    if (d.kind === 'opt') {
      if (d.done) { busy(null); S.opt.done = true; }
      else if (d.needWide) S.opt.needWide = true;
      else if ('wide' in d) S.opt.wide = d.wide;
      else S.opt.rows[d.n - 1] = d.r;
      renderAll(); return;
    }
  };
  const runSync = (msg) => {
    setTimeout(() => {
      if (msg.id !== job) return;
      if (msg.kind === 'opt') {
        const o = { step: msg.step, amin: msg.amin, amax: msg.amax };
        const res = KV.optimize(msg.exist, msg.tlo, msg.thi, msg.bmin, msg.bmax, { ...o, nmax: msg.nmax, seeds: msg.seeds, onStep: (r, n) => onResult({ id: msg.id, kind: 'opt', n, r }) });
        const last = res.results[res.results.length - 1];
        if (res.results.length && last.cov < 1) {
          onResult({ id: msg.id, kind: 'opt', needWide: true });
          setTimeout(() => { if (msg.id !== job) return; onResult({ id: msg.id, kind: 'opt', wide: KV.widen(msg.exist, msg.tlo, msg.thi, msg.bmin, msg.bmax, { ...o, maxN: msg.nmax, okLimit: 10000 }) }); onResult({ id: msg.id, kind: 'opt', done: true }); }, 30);
          return;
        }
        onResult({ id: msg.id, kind: 'opt', done: true }); return;
      }
    }, 30);
  };
  const start = (kind) => {
    job++;
    if (worker && running) { worker.terminate(); worker = null; }
    if (!worker && !noWorker) {
      worker = makeWorker();
      if (worker) {
        worker.onmessage = (e) => onResult(e.data);
        worker.onerror = () => { if (worker) worker.terminate(); worker = null; noWorker = true; runSync(lastMsg); };
      }
    }
    const msg = { id: job, kind, exist: [...S.exist], tlo: S.tlo, thi: S.thi, bmin: S.bmin, bmax: S.bmax, step: S.step, nmax: S.nmax, amin: S.amin, amax: S.amax, seeds: [S.added] };
    lastMsg = msg;
    if (kind === 'opt') S.opt = { rows: [], done: false, nmax: S.nmax, base: KV.optimize(S.exist, S.tlo, S.thi, S.bmin, S.bmax, { nmax: 0 }).base };
    busy(kind);
    renderAll();
    if (worker) worker.postMessage(msg); else runSync(msg);
  };
  const runOptimize = () => start('opt');
  // jede Eingabeänderung verwirft eine laufende Rechnung und das Optimierungsergebnis
  const cancelJob = () => { S.opt = null; if (running) { job++; if (worker) { worker.terminate(); worker = null; } busy(null); } };
  optBtn.addEventListener('click', runOptimize);
  const renderN = () => { $('n-v').textContent = S.nmax; $('n-m').disabled = S.nmax <= 1; $('n-p').disabled = S.nmax >= 5; };
  const setN = (d) => { S.nmax = Math.min(Math.max(S.nmax + d, 1), 5); if (running === 'opt') cancelJob(); else S.opt = null; save(); renderN(); renderAll(); };
  $('n-m').addEventListener('click', () => setN(-1));
  $('n-p').addEventListener('click', () => setN(1));
  const renderStep = () => { $('st-v').textContent = fd(S.step); $('st-m').disabled = S.step <= 0.1 + 1e-9; $('st-p').disabled = S.step >= 1 - 1e-9; };
  const setStep = (d) => { S.step = Math.min(Math.max(Math.round((S.step + d) * 10) / 10, 0.1), 1); S.variants = null; cancelJob(); save(); renderStep(); renderAll(); };
  $('st-m').addEventListener('click', () => setStep(-0.1));
  $('st-p').addEventListener('click', () => setStep(0.1));

  const axisMax = (u, maxTicks = 6) => {
    const hi = Math.max(S.thi, ...u.map((s) => s[1]), 100);
    let step = 1;
    for (let e = 1; ; e *= 10) { const s = [1, 2, 5].map((k) => k * e).find((s) => Math.ceil(hi / s) + 1 <= maxTicks); if (s) { step = s; break; } }
    return { max: Math.ceil(hi / step) * step, step };
  };

  const renderOpt = () => {
    const wide = matchMedia('(min-width: 1100px)').matches;
    const box = $(wide ? 'opt-ctrl' : 'opt-out'), other = $(wide ? 'opt-out' : 'opt-ctrl');
    other.replaceChildren(); box.replaceChildren();
    $('s-opt').hidden = wide || !S.opt;
    if (!S.opt) return;
    const head = document.createElement('div'); head.className = 'small'; head.textContent = 'Optimierung: je Anzahl Fräser die schmalsten Lamellen im Mittel';
    box.appendChild(head);
    const desc = (r) => r.cov > 0 ? `Ø ${r.mean.toFixed(1).replace('.', ',')} mm · max ${Math.ceil(r.worst - 1e-6)} mm` + (r.cov < 1 ? ` · deckt ${Math.floor(r.cov * 100)} %` : '') : 'deckt nichts ab';
    const line = (k, content) => { const row = document.createElement('div'); row.className = 'orow'; const s = document.createElement('span'); s.className = 'small num'; s.textContent = k; row.appendChild(s); row.appendChild(content); box.appendChild(row); };
    const txtEl = (t) => { const e = document.createElement('span'); e.className = 'msg'; e.textContent = t; return e; };
    line('0', txtEl('nur vorhandene: ' + desc(S.opt.base)));
    let prev = S.opt.base;
    for (let n = 1; n <= S.opt.nmax; n++) {
      const r = S.opt.rows[n - 1];
      if (!r) { line(n, txtEl(S.opt.done ? 'keine weiteren Winkel im Bereich' : 'rechnet …')); continue; }
      if (r.cov === 0) { line(n, txtEl('deckt nichts ab')); prev = r; continue; }
      const better = !prev || prev.cov === 0 || Math.floor(r.cov * 100) > Math.floor(prev.cov * 100) || (Math.floor(r.cov * 100) === Math.floor(prev.cov * 100) && Math.round(r.mean * 10) < Math.round(prev.mean * 10));
      if (!better) { line(n, txtEl('keine weitere Verbesserung')); continue; }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'vbtn';
      b.setAttribute('aria-pressed', sameSet(r.combo, S.added) ? 'true' : 'false');
      for (const c of r.combo) { b.appendChild(swatch(colfor(c), true)); const t = document.createElement('span'); t.textContent = '+' + fd(c); b.appendChild(t); }
      const w = document.createElement('span'); w.className = 'w'; w.textContent = desc(r); b.appendChild(w);
      b.addEventListener('click', () => { S.added = [...r.combo]; save(); renderAll(); });
      line(n, b); prev = r;
    }
    if (S.opt.needWide) {
      const row = document.createElement('div'); row.className = 'orow';
      const s0 = document.createElement('span'); s0.className = 'small'; row.appendChild(s0);
      const wd = S.opt.wide;
      if (wd === undefined) row.appendChild(txtEl('ganz erreichbar mit breiterer Lamelle? rechnet …'));
      else if (!wd) row.appendChild(txtEl(`auch mit Lamelle bis 60 mm und ${S.opt.nmax} Fräsern nicht ganz erreichbar`));
      else {
        const combo = wd.variant ? wd.variant.combo : [];
        const b = document.createElement('button'); b.type = 'button'; b.className = 'vbtn';
        const t0 = document.createElement('span'); t0.textContent = `ganz erreichbar mit Lamelle bis ${wd.bmax} mm`; b.appendChild(t0);
        for (const c of combo) { b.appendChild(swatch(colfor(c), true)); const t = document.createElement('span'); t.textContent = '+' + fd(c); b.appendChild(t); }
        b.title = 'übernimmt die Lamellenbreite und rechnet die Optimierung neu';
        b.addEventListener('click', () => { S.bmax = wd.bmax; bwHi.value = wd.bmax; S.added = [...combo]; save(); renderWidth(); start('opt'); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
  };

  // ---------- Abdeckung ----------
  const renderChart = (grs, uAll, uEx, ax) => {
    const box = $('chart');
    const W = Math.max(box.clientWidth, 280), wide = W >= 620 || matchMedia('(min-width: 1100px)').matches;
    const lane = grs.length > 16 ? 14 : grs.length > 11 ? 16 : 22;
    const XL = wide ? 220 : 0, x1 = W - 2;
    const X = (r) => XL + (x1 - XL) * Math.min(Math.max(r, 0), ax.max) / ax.max;
    const s = el('svg', { width: W, viewBox: `0 0 ${W} 100`, role: 'img', 'aria-label': 'Abdeckung der Radien je Fräserpaar' });
    const defs = el('defs', {}, s);
    hatchDef(defs, 'hatchE', 7, 3.6);
    const gr = el('linearGradient', { id: 'rg', gradientUnits: 'userSpaceOnUse', x1: XL, y1: 0, x2: x1, y2: 0 }, defs);
    for (let k = 0; k <= 48; k++) { const f = k / 48; el('stop', { offset: f, 'stop-color': rcol(f * ax.max) }, gr); }
    const gGrid = el('g', {}, s), gTarget = el('g', {}, s), g = el('g', {}, s);
    const bar = (a, b, y, h, hatched) => {
      if (!(isFinite(a) && isFinite(b)) || b <= a) return;
      const xa = X(a), xb = X(b);
      if (xb - xa < 0.5) return;
      el('rect', { x: xa.toFixed(1), y, width: (xb - xa).toFixed(1), height: h, fill: 'url(#rg)', 'fill-opacity': hatched ? 0.8 : 1 }, g);
      if (hatched) el('rect', { x: xa.toFixed(1), y, width: (xb - xa).toFixed(1), height: h, fill: 'url(#hatchE)' }, g);
    };
    const mark = (x, y, hatched) => { el('rect', { x, y: y - 10, width: 10, height: 10, fill: C.mu }, g); if (hatched) for (let k = -10; k < 10; k += 5) ln(g, x + k, y, x + k + 10, y - 10, C.bg, 1.8); };
    let y = 44;
    const top = y;
    // Gesamt
    if (wide) txt(g, 0, y + 12, 'Gesamt', 12);
    else { txt(g, 0, y, 'Gesamt', 12); y += 10; }
    for (const [a, b] of uAll) {
      let cur = a;
      for (const [c, d] of [...uEx, [b, b]]) {
        const lo = cur, hi = Math.min(c, b);
        if (hi > lo + 1) bar(lo, hi, y, 16, true);
        const sl = Math.max(c, a), sh = Math.min(d, b);
        if (sh > sl + 1) bar(sl, sh, y, 16, false);
        cur = Math.max(cur, d);
      }
    }
    // Beschriftung der Bereiche, bei Platzmangel eine Zeile tiefer
    // Beschriftung der Bereiche: neben den Balken, wenn alle sauber Platz haben, sonst gemeinsam in einer Zeile darunter
    let extra = 0;
    const cw = 6.7, labs = uAll.map(([a, b]) => `R ${fmt(a)} – ${fmt(b)}`), place = [];
    let ok = wide, lastEnd = -Infinity;
    for (let i = 0; ok && i < uAll.length; i++) {
      const [a, b] = uAll[i], w = labs[i].length * cw;
      const nextX = i + 1 < uAll.length ? X(uAll[i + 1][0]) : x1 + 1, prevX = i > 0 ? X(uAll[i - 1][1]) : -Infinity;
      let l = X(b) + 10, r = l + w;
      if (r < nextX - 6 && r <= x1 && l > lastEnd + 12) { place.push([l, 'start']); lastEnd = r; continue; }
      r = X(a) - 10; l = r - w;
      if (l >= 0 && l > Math.max(prevX, lastEnd) + 6) { place.push([r, 'end']); lastEnd = X(b); continue; }
      ok = false;
    }
    if (ok) place.forEach(([x, anchor], i) => txt(g, x, y + 13, labs[i], 12, C.fg, anchor));
    else if (uAll.length) { txt(g, XL, y + 36, labs.join('  ·  '), 12, C.fg, 'start', { class: 'num' }); extra = 20; }
    if (!uAll.length) txt(g, XL, y + 13, 'Kein zulässiges Fräserpaar: zwei verschiedene Fräser nötig, der größere ab 10°', 12, C.mu);
    y += (wide ? 34 : 40) + extra;
    ln(g, 0, y - 14, x1, y - 14, C.hl, 1);
    for (const grp of grs) {
      if (wide) {
        mark(0, y + 10, grp.isNew);
        el('title', {}, txt(g, 18, y + 10, pairShort(grp), 12, C.mu)).textContent = pairTxt(grp);
        txt(g, XL - 14, y + 10, `Knick ${fd(grp.d)}`, 11, C.mu, 'end');
      } else {
        mark(0, y + 2, grp.isNew);
        txt(g, 18, y + 2, `Knick ${fd(grp.d)}  ·  ${pairShort(grp)}`, 11, C.mu);
        y += 10;
      }
      const uN = KV.union(grp.pairs.filter((p) => p.isNew).map((p) => p.range));
      const uO = KV.union(grp.pairs.filter((p) => !p.isNew).map((p) => p.range));
      for (const [p, q] of uN) bar(p, q, y, 10, true);
      for (const [p, q] of uO) bar(p, q, y, 10, false);
      if (!uN.length && !uO.length) txt(g, XL, y + 9, 'Lamelle zu schmal für diese Flanken', 11, C.mu);
      y += wide ? lane : 30;
    }
    const yax = y + 2;
    // Ziel
    el('rect', { x: X(S.tlo).toFixed(1), y: top - 22, width: Math.max(X(S.thi) - X(S.tlo), 1).toFixed(1), height: yax - top + 14, fill: '#FFFFFF', 'fill-opacity': 0.04, stroke: C.mu, 'stroke-width': 0.8, 'stroke-dasharray': '3 4' }, gTarget);
    txt(gTarget, X(S.tlo) + 6, top - 28, 'Ziel', 11, C.mu);
    for (let t = 0; t <= ax.max; t += ax.step) {
      ln(gGrid, X(t), top - 16, X(t), yax, C.grid, 1);
      const anchor = t === 0 && !wide ? 'start' : t === ax.max ? 'end' : 'middle';
      txt(g, X(t), yax + 20, fmt(t), 11, C.mu, anchor);
    }
    txt(g, x1, yax + 42, 'R auf Mittelachse in mm', 11, C.mu, 'end');
    const Hh = yax + 52;
    s.setAttribute('viewBox', `0 0 ${W} ${Hh}`); s.setAttribute('height', Hh);
    box.replaceChildren(s);
  };

  // ---------- Szenarien ----------
  const renderScenarios = (grs, uAll) => {
    const box = $('scen');
    box.replaceChildren();
    const radii = KV.scenarioRadii(uAll, 12);
    const cells = radii.map((R) => {
      const hit = KV.best(R, grs, S.bmin, S.bmax);
      let w, b, g = null, p = null;
      if (hit) {
        g = hit.g; b = hit.b; p = hit.p;
        w = KV.wall(p.hi, p.lo, b);
      } else {
        // gedachte Wand mit schmalster Lamelle bei 15°, nur grau
        const bm = KV.bmid(S.bmin, 15, 15);
        const dd = 2 * Math.asin(Math.min(bm / (2 * R), 1)) * 180 / Math.PI;
        w = KV.wall(15, 15 - dd, S.bmin);
      }
      const all = [...w.lams.flatMap((l) => l.poly), ...w.backA, ...w.backB];
      const xs = all.map((p) => -p[0]), ys = all.map((p) => p[1]);
      return { R, b, g, p, w, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    });
    const cols = getComputedStyle(box).gridTemplateColumns.split(' ').length || 2;
    const VW = Math.max(220, ...cells.map((c) => c.maxX - c.minX + 8)), PAD = 4;
    for (let r0 = 0; r0 < cells.length; r0 += cols) {
      const row = cells.slice(r0, r0 + cols);
      const hmax = Math.max(...row.map((c) => c.maxY - c.minY)) + 2 * PAD;
      for (const c of row) {
        const off = !c.g;
        const cell = document.createElement('div'); cell.className = 'cell' + (off ? ' off' : '');
        const cx = (c.minX + c.maxX) / 2;
        const s = el('svg', { viewBox: `${(cx - VW / 2).toFixed(2)} ${(c.minY - PAD).toFixed(2)} ${VW} ${hmax.toFixed(2)}`, role: 'img', 'aria-label': off ? `R ${fmt(c.R)}, nicht abbildbar` : `R ${fmt(c.R)} mit ${fd(c.p.hi)} / ${fd(c.p.lo)}, Lamelle ${Math.ceil(c.b - 1e-6)} mm` });
        const defs = el('defs', {}, s);
        hatchDef(defs, 'hS' + r0 + '_' + cells.indexOf(c), 4.4, 2.2);
        const hid = 'hS' + r0 + '_' + cells.indexOf(c);
        const ca = off ? '#3A3A38' : rcol(c.R), cb = off ? '#303030' : darker(ca, 0.8);
        for (const k of ['backA', 'backB']) el('polygon', { points: pts(c.w[k]), fill: off ? '#262625' : C.back }, s);
        for (const l of c.w.lams) {
          el('polygon', { points: pts(l.poly), fill: l.kind === 'A' ? ca : cb, stroke: C.bg, 'stroke-width': 0.8, 'vector-effect': 'non-scaling-stroke' }, s);
          if (!off && c.p.isNew) el('polygon', { points: pts(l.poly), fill: `url(#${hid})` }, s);
        }
        cell.appendChild(s);
        const t = document.createElement('div');
        const head = document.createElement('div'); head.className = 'head';
        const r = document.createElement('span'); r.className = 'r'; r.textContent = 'R\u00A0' + fmt(c.R); head.appendChild(r);
        if (!off) { const b = document.createElement('span'); b.className = 'small num'; b.textContent = `Lamelle ${Math.ceil(c.b - 1e-6)} mm`; head.appendChild(b); }
        t.appendChild(head);
        const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = off ? 'nicht abbildbar' : `${fd(c.p.hi)} / ${fd(c.p.lo)}`;
        t.appendChild(sub);
        cell.appendChild(t);
        box.appendChild(cell);
      }
    }
    if (!cells.length) { const m = document.createElement('div'); m.className = 'msg'; m.textContent = 'Kein zulässiges Fräserpaar: zwei verschiedene Fräser nötig, der größere ab 10°.'; box.appendChild(m); }
  };

  // ---------- Steuerung einklappen (Handy) ----------
  const ctrl = document.querySelector('.ctrl'), bars = [$('ctrl-head')];
  let collapsed = false;
  try { collapsed = localStorage.getItem('kv-collapsed') === '1'; } catch (e) { /* ohne Speicher */ }
  const applyCollapse = () => {
    ctrl.classList.toggle('collapsed', collapsed);
    for (const b of bars) { b.setAttribute('aria-expanded', collapsed ? 'false' : 'true'); b.setAttribute('aria-label', collapsed ? 'Steuerung ausklappen' : 'Steuerung einklappen'); }
  };
  for (const b of bars) b.addEventListener('click', () => { collapsed = !collapsed; try { localStorage.setItem('kv-collapsed', collapsed ? '1' : '0'); } catch (e) { /* egal */ } applyCollapse(); });
  const renderSum = () => {
    const ex = KV.uniq(S.exist).map(fd).join(' '), ad = KV.uniq(S.added).map((c) => '+' + fd(c)).join(' ');
    $('ctrl-sum').textContent = `${S.bmin}–${S.bmax} mm · ${ex}${ad ? ' ' + ad : ''} · R ${fmt(S.tlo)}–${fmt(S.thi)}`;
  };
  applyCollapse();

  // ---------- Alles ----------
  const renderAll = () => {
    renderSum();
    chipRow($('chips-ex'), 'exist', false);
    chipRow($('chips-add'), 'added', true);
    const all = [...S.exist, ...S.added];
    const grs = KV.groups(S.exist, S.added, S.bmin, S.bmax);
    const uAll = KV.cover(all, S.bmin, S.bmax), uEx = KV.cover(S.exist, S.bmin, S.bmax);
    const ax = axisMax(uAll, $('chart').clientWidth >= 620 ? 7 : 5);
    renderOpt();
    renderChart(grs, uAll, uEx, ax);
    renderScenarios(grs, uAll);
  };

  document.addEventListener('click', (e) => {
    const i = e.target.closest('.info');
    document.querySelectorAll('.info.open').forEach((x) => { if (x !== i) x.classList.remove('open'); });
    if (i) i.classList.toggle('open');
  });
  // gespeicherte Werte prüfen: außerhalb der Regler zurück auf Standard, sonst auf das Raster
  const okRange = (lo, hi, mn, mx, gap) => isFinite(lo) && isFinite(hi) && lo >= mn && hi <= mx && hi - lo >= gap;
  if (!okRange(S.tlo, S.thi, 200, 5000, 10)) { S.tlo = 1000; S.thi = 2000; }
  S.tlo = Math.round(S.tlo / 10) * 10; S.thi = Math.max(Math.round(S.thi / 10) * 10, S.tlo + 10);
  if (!okRange(S.bmin, S.bmax, 20, 60, 1)) { S.bmin = 20; S.bmax = 40; }
  S.bmin = Math.round(S.bmin); S.bmax = Math.max(Math.round(S.bmax), S.bmin + 1);
  tLo.value = S.tlo; tHi.value = S.thi; bwLo.value = S.bmin; bwHi.value = S.bmax;
  S.step = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1].includes(S.step) ? S.step : 0.5;
  S.nmax = [1, 2, 3, 4, 5].includes(S.nmax) ? S.nmax : 3;
  if (!(S.amin >= 0 && S.amax <= 32 && S.amax - S.amin >= 0.5)) { S.amin = 10; S.amax = 20; }
  S.amin = Math.round(S.amin * 2) / 2; S.amax = Math.round(S.amax * 2) / 2; aLo.value = S.amin; aHi.value = S.amax;
  renderAngles();
  renderStep();
  renderN();
  renderWidth();
  renderTarget();
  renderDetail();
  renderAll();
  let rt = 0, lastW = 0;
  new ResizeObserver(() => {
    const w = $('chart').clientWidth;
    if (Math.abs(w - lastW) < 2) return; lastW = w;
    clearTimeout(rt); rt = setTimeout(renderAll, 80);
  }).observe($('chart'));
})();
