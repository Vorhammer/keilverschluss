// Keilverschluss – Rechenkern
const KVF = () => {
  const H = 8;      // Lamellenhöhe in mm
  const T = 1.2;    // Deckschicht in mm
  const STEG = 2;   // schmalste Stelle der Lamelle (Lamellengrund) in mm, darunter gibt es die Lamelle nicht
  const AMIN = 10;  // der größere Flankenwinkel eines Paars muss mindestens so groß sein, sonst hält der Verbund nicht
  const rad = (d) => d * Math.PI / 180;
  const EPS = 1e-9;

  // Breite auf der Mittelachse aus der Breite an der Lamellenoberseite
  const bmid = (b, a1, a2) => b - H * (Math.tan(rad(a1)) + Math.tan(rad(a2))) / 2;
  // Radius auf der Mittelachse
  const radius = (b, a1, a2) => {
    const d = Math.abs(a1 - a2), m = bmid(b, a1, a2);
    if (d < EPS || m <= 0) return NaN;
    return m / (2 * Math.sin(rad(d) / 2));
  };
  // nötige Lamellenbreite (Oberseite) für einen Radius
  const bneed = (R, a1, a2) => {
    const d = Math.abs(a1 - a2);
    return 2 * R * Math.sin(rad(d) / 2) + H * (Math.tan(rad(a1)) + Math.tan(rad(a2))) / 2;
  };

  const r2 = (v) => Math.round(v * 100) / 100;
  const uniq = (cuts) => [...new Set(cuts.map(r2))].sort((a, b) => a - b);
  const pairs = (cuts) => {
    const u = uniq(cuts), out = [];
    for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
      if (u[j] < AMIN) continue;
      out.push({ hi: u[j], lo: u[i], d: u[j] - u[i] });
    }
    return out;
  };
  const union = (iv) => {
    const s = iv.filter((x) => isFinite(x[0]) && isFinite(x[1])).sort((a, b) => a[0] - b[0]), u = [];
    for (const [a, b] of s) {
      if (u.length && a <= u[u.length - 1][1] * 1.0001) u[u.length - 1][1] = Math.max(u[u.length - 1][1], b);
      else u.push([a, b]);
    }
    return u;
  };
  // kleinste Lamellenbreite, bei der der Lamellengrund des steileren Fräsers noch STEG breit bleibt
  const bfloor = (hi, lo) => STEG + H * Math.tan(rad(Math.max(hi, lo))) + H * (Math.tan(rad(hi)) + Math.tan(rad(lo))) / 2;
  const bLow = (bmin, hi, lo) => Math.max(bmin, bfloor(hi, lo));
  const range = (p, bmin, bmax) => { const b0 = bLow(bmin, p.hi, p.lo); return b0 > bmax ? [NaN, NaN] : [radius(b0, p.hi, p.lo), radius(bmax, p.hi, p.lo)]; };
  const cover = (cuts, bmin, bmax) => union(pairs(cuts).map((p) => range(p, bmin, bmax)));

  // Paare mit gleichem Knick zusammenfassen; Stellvertreter bevorzugt aus vorhandenen Fräsern
  const groups = (exist, added, bmin, bmax) => {
    const all = uniq([...exist, ...added]), ex = new Set(uniq(exist)), m = new Map();
    for (const p of pairs(all)) {
      const k = p.d.toFixed(3);
      if (!m.has(k)) m.set(k, []);
      p.isNew = !(ex.has(p.hi) && ex.has(p.lo));
      p.range = range(p, bmin, bmax);
      m.get(k).push(p);
    }
    return [...m.values()].map((gr) => {
      const rep = gr.find((p) => !p.isNew) || gr[0];
      return { pairs: gr, rep, d: rep.d, isNew: gr.every((p) => p.isNew), range: rep.range };
    }).sort((a, b) => b.d - a.d);
  };

  // schmalste Lösung für einen Radius
  const best = (R, grs, bmin, bmax) => {
    const cand = [];
    for (const g of grs) for (const p of g.pairs) {
      const b = bneed(R, p.hi, p.lo);
      if (b >= bLow(bmin, p.hi, p.lo) - 1e-6 && b <= bmax + 1e-6) cand.push({ b, g, p });
    }
    if (!cand.length) return null;
    cand.sort((x, y) => x.b - y.b);
    // innerhalb 0,5 mm gewinnt ein Paar aus vorhandenen Fräsern
    return cand.find((c) => !c.p.isNew && c.b <= cand[0].b + 0.5) || cand[0];
  };

  const covers = (u, lo, hi) => u.some(([a, b]) => a <= lo + 1e-6 && b >= hi - 1e-6);

  // Vorschlag: wenigste Zusatzfräser, dann schmalste nötige Lamelle, dann Reserve.
  // Ohne Lösung: die Kombination, die den größten zusammenhängenden Teil des Ziels abdeckt.
  const search = (exist, tlo, thi, bmin, bmax, opts = {}) => {
    const step = opts.step ?? 0.5, amin = opts.amin ?? 0, amax = opts.amax ?? 45, maxN = opts.maxN ?? 3, any = !!opts.any;
    const beamK = opts.beamK ?? 150, exLimit = opts.exLimit ?? 600000;
    const ex = uniq(exist), exs = new Set(ex);
    const exU = cover(ex, bmin, bmax);
    if (covers(exU, tlo, thi)) return { variants: [], covered: true, nearest: null };
    const grid = [];
    for (let k = Math.ceil(amin / step - 1e-9); k * step <= amax + 1e-9; k++) { const a = r2(k * step); if (!exs.has(a)) grid.push(a); }
    if (!grid.length) return { variants: [], covered: false, nearest: null, noGrid: true };
    const span = thi - tlo;
    const partOf = (u) => {
      let part = 0, pseg = null, tot = 0;
      for (const [a, b] of u) { const o = Math.min(b, thi) - Math.max(a, tlo); if (o > 0) { tot += o; if (o > part) { part = o; pseg = [Math.max(a, tlo), Math.min(b, thi)]; } } }
      return { part, pseg, tot };
    };
    const base = partOf(exU).part;
    const cache = new Map();
    const rng = (hi, lo) => { const k = Math.round(hi * 100) * 100000 + Math.round(lo * 100); let r = cache.get(k); if (!r) { r = range({ hi, lo }, bmin, bmax); cache.set(k, r); } return r; };
    const exIv = [];
    for (let i = 0; i < ex.length; i++) for (let j = i + 1; j < ex.length; j++) if (ex[j] >= AMIN) { const r = rng(ex[j], ex[i]); if (isFinite(r[0])) exIv.push(r); }
    const add = (iv, a, b) => { const hi = a > b ? a : b, lo = a > b ? b : a; if (hi >= AMIN && hi !== lo) { const r = rng(hi, lo); if (isFinite(r[0])) iv.push(r); } };
    const covOf = (combo) => {
      const iv = exIv.slice();
      for (let i = 0; i < combo.length; i++) { for (const e of ex) add(iv, combo[i], e); for (let j = i + 1; j < combo.length; j++) add(iv, combo[i], combo[j]); }
      return union(iv);
    };
    const samples = [];
    for (let k = 0; k <= 40; k++) samples.push(tlo * Math.pow(thi / tlo, k / 40));
    let nearest = null;
    const evalCombo = (combo) => {
      const u = covOf(combo);
      const seg = u.find(([a, b]) => a <= tlo + 1e-6 && b >= thi - 1e-6);
      if (!seg) {
        const { part, pseg, tot } = partOf(u);
        // Teilabdeckung nur, wenn sie spürbar über den vorhandenen Fräsern liegt; ein weiterer Fräser muss mindestens 5 % des Ziels mehr bringen
        if (pseg && part > base + 0.01 * span && (!nearest || (combo.length === nearest.combo.length ? part > nearest.part + 1e-6 : part > nearest.part + 0.05 * span))) {
          nearest = { combo: [...combo], part, share: part / span, seg: pseg };
        }
        return { combo, part, tot };
      }
      const ps = pairs([...ex, ...combo]);
      let worst = 0;
      for (const R of samples) {
        let m = Infinity;
        for (const p of ps) { const b = bneed(R, p.hi, p.lo); if (b >= bLow(bmin, p.hi, p.lo) - 1e-6 && b <= bmax + 1e-6 && b < m) m = b; }
        if (m > worst) worst = m;
      }
      const reserve = Math.min(tlo / seg[0], seg[1] / thi) - 1;
      const near = combo.reduce((s, c) => s + Math.min(...ex.map((e) => Math.abs(c - e)), 99), 0);
      return { combo: [...combo], seg, worst, reserve, near, full: true };
    };
    const N = grid.length;
    let prev = [];
    for (let n = 1; n <= maxN; n++) {
      const out = [], full = [];
      let stop = false;
      const push = (combo) => { const r = evalCombo(combo); if (r.full) { full.push(r); if (any) stop = true; } else if (n < maxN) out.push({ combo: [...combo], part: r.part, tot: r.tot }); };
      if (n === 1) { for (const a of grid) { push([a]); if (stop) break; } }
      else {
        const cnt = n === 2 ? N * (N - 1) / 2 : N * (N - 1) * (N - 2) / 6;
        if (cnt <= exLimit) {
          const cur = [];
          const rec = (start) => {
            if (cur.length === n) { push(cur); return; }
            for (let i = start; i < N && !stop; i++) { cur.push(grid[i]); rec(i + 1); cur.pop(); }
          };
          rec(0);
        } else {
          // schnelle Vorauswahl: die vielversprechendsten kleineren Kombinationen (gestreut) um einen Fräser erweitern
          prev.sort((a, b) => (b.part - a.part) || (b.tot - a.tot));
          const use = new Map(), top = [];
          for (const t of prev) {
            if (top.length >= beamK) break;
            if (t.combo.some((a) => (use.get(a) || 0) >= 4)) continue;
            for (const a of t.combo) use.set(a, (use.get(a) || 0) + 1);
            top.push(t);
          }
          const seen = new Set();
          outer: for (const t of top) for (const a of grid) {
            if (t.combo.includes(a)) continue;
            const combo = [...t.combo, a].sort((x, y) => x - y), key = combo.join('|');
            if (seen.has(key)) continue; seen.add(key);
            push(combo);
            if (stop) break outer;
          }
        }
      }
      if (full.length) {
        full.sort((a, b) => (Math.round(a.worst * 10) - Math.round(b.worst * 10)) || (b.reserve - a.reserve) || (a.near - b.near));
        return { variants: full.slice(0, 3), covered: false, nearest: null };
      }
      prev = out;
    }
    return { variants: [], covered: false, nearest };
  };
  const suggest = (exist, tlo, thi, bmin, bmax, opts = {}) => search(exist, tlo, thi, bmin, bmax, opts).variants;
  // kleinste Obergrenze der Lamellenbreite (bis 60 mm), mit der das Ziel mit höchstens drei Ergänzungen erreichbar wird
  const widen = (exist, tlo, thi, bmin, bmax, opts = {}) => {
    const cap = opts.bcap ?? 60;
    // Prüfschritte mit schneller Vorauswahl, damit die Suche auf dem Handy erträglich bleibt
    const ok = (b) => { const r = search(exist, tlo, thi, bmin, b, { ...opts, any: true, exLimit: opts.okLimit ?? 40000, beamK: 100 }); return r.covered || r.variants.length > 0; };
    if (bmax >= cap || !ok(cap)) return null;
    let lo = bmax, hi = cap; // lo geht nicht, hi geht
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (ok(m)) hi = m; else lo = m; }
    // die schnelle Vorauswahl ist nicht streng monoton: ein paar kleinere Breiten zusätzlich prüfen
    let best = hi;
    for (let b = hi - 1; b > Math.max(bmax, hi - 7); b--) if (ok(b)) best = b;
    hi = best;
    // Endsuche mit normalen Einstellungen; findet sie bei dieser Breite nichts, etwas breiter versuchen, zuletzt die schnelle Auswahl übernehmen
    for (let b = hi; b <= Math.min(cap, hi + 3); b++) {
      const r = search(exist, tlo, thi, bmin, b, opts);
      if (r.covered || r.variants.length) return { bmax: b, variant: r.variants[0] || null, covered: r.covered };
    }
    const r = search(exist, tlo, thi, bmin, hi, { ...opts, exLimit: opts.okLimit ?? 40000, beamK: 100 });
    if (!r.covered && !r.variants.length) return null;
    return { bmax: hi, variant: r.variants[0] || null, covered: r.covered };
  };

  // Optimierung: bei höchstens nmax Ergänzungen möglichst viel des Ziels abdecken, dann möglichst schmale Lamellen im Mittel über alle Radien
  const optimize = (exist, tlo, thi, bmin, bmax, opts = {}) => {
    const step = opts.step ?? 0.5, nmax = opts.nmax ?? 3, onStep = opts.onStep || (() => {}), amin = opts.amin ?? 0, amax = opts.amax ?? 45;
    const ex = uniq(exist), exs = new Set(ex);
    const seeds = (opts.seeds || []).map((s) => uniq(s)).filter((s) => s.length && s.every((a) => a >= amin - 1e-9 && a <= amax + 1e-9 && Math.abs(a / step - Math.round(a / step)) < 1e-6 && !exs.has(a)));
    const grid = [];
    for (let k = Math.ceil(amin / step - 1e-9); k * step <= amax + 1e-9; k++) { const a = r2(k * step); if (!exs.has(a)) grid.push(a); }
    // 81 Radien einschließlich der Ränder des Ziels
    const NS = 81, Rs = [];
    for (let k = 0; k < NS; k++) Rs.push(tlo + (thi - tlo) * k / (NS - 1));
    const span = thi - tlo || 1;
    const coef = (hi, lo) => [2 * Math.sin(rad(hi - lo) / 2), H * (Math.tan(rad(hi)) + Math.tan(rad(lo))) / 2];
    // beste Breite je Radius aus den vorhandenen Fräsern
    const exBest = new Float64Array(NS).fill(Infinity);
    const fold = (best, hi, lo) => { if (hi < AMIN || hi === lo) return; const b0 = bLow(bmin, hi, lo); if (b0 > bmax) return; const [s, c0] = coef(hi, lo); for (let k = 0; k < NS; k++) { const b = Rs[k] * s + c0; if (b >= b0 - 1e-6 && b <= bmax + 1e-6 && b < best[k]) best[k] = b; } };
    for (let i = 0; i < ex.length; i++) for (let j = i + 1; j < ex.length; j++) fold(exBest, ex[j], ex[i]);
    const score = (combo) => {
      const best = Float64Array.from(exBest);
      for (let i = 0; i < combo.length; i++) {
        for (const e of ex) fold(best, Math.max(combo[i], e), Math.min(combo[i], e));
        for (let j = i + 1; j < combo.length; j++) fold(best, Math.max(combo[i], combo[j]), Math.min(combo[i], combo[j]));
      }
      let n = 0, sum = 0, worst = 0;
      for (let k = 0; k < NS; k++) if (best[k] < Infinity) { n++; sum += best[k]; if (best[k] > worst) worst = best[k]; }
      // Anteil exakt aus den Bereichen der Paare, damit 100 % wirklich lückenlos heißt
      let cov = 0;
      if (n) {
        const u = cover([...ex, ...combo], bmin, bmax);
        if (covers(u, tlo, thi)) cov = 1;
        else { let len = 0; for (const [a, b] of u) { const o = Math.min(b, thi) - Math.max(a, tlo); if (o > 0) len += o; } cov = Math.min(len / span, 0.9999); }
      }
      const mean = n ? sum / n : Infinity;
      return { combo: [...combo].sort((a, b) => a - b), cov, mean, worst, key: n ? (1 - cov) * 1e4 + mean : Infinity };
    };
    const results = [];
    const pools = [[score([])]];
    // alle Zweierkombinationen vollständig (bei feinem Raster gut 100 000), die besten dienen als Bausteine
    const pairsAll = [];
    let pre1 = null;
    if (nmax >= 1 && grid.length) { pre1 = [...grid.map((a) => score([a])), ...seeds.filter((s) => s.length === 1).map((s) => score(s))].sort((x, y) => x.key - y.key); results.push(pre1[0]); onStep(pre1[0], 1); pools.push(pre1.slice(0, 8)); }
    if (nmax >= 2) for (let i = 0; i < grid.length; i++) for (let j = i + 1; j < grid.length; j++) pairsAll.push(score([grid[i], grid[j]]));
    pairsAll.sort((x, y) => x.key - y.key);
    const P2 = pairsAll.slice(0, 40);
    for (let n = 2; n <= Math.min(nmax, grid.length); n++) {
      const cand = [], seen = new Set();
      const tryC = (combo) => { combo = [...new Set(combo)].sort((x, y) => x - y); if (combo.length !== n) return; const key = combo.join('|'); if (seen.has(key)) return; seen.add(key); cand.push(score(combo)); };
      const N = grid.length;
      if (n === 2) cand.push(...pairsAll.slice(0, 60));
      else if (n === 3 && N * (N - 1) * (N - 2) / 6 <= 150000) {
        // bei grobem Raster alle Dreier vollständig
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) for (let k = j + 1; k < N; k++) cand.push(score([grid[i], grid[j], grid[k]]));
      } else {
        for (const p of pools[n - 1]) for (const a of grid) if (!p.combo.includes(a)) tryC([...p.combo, a]);
        if (n >= 3) for (const p of pools[n - 2]) for (const q of P2) tryC([...p.combo, ...q.combo]);
      }
      for (const s of seeds) if (s.length === n) cand.push(score(s));
      cand.sort((x, y) => x.key - y.key);
      // lokale Verbesserung: je Fräser jeden anderen Rasterwinkel probieren, bis sich nichts mehr verbessert
      const better = [];
      cand.slice(0, 6).forEach((s0, si) => {
        let cur = s0, moved = true, rounds = 0;
        while (moved && rounds++ < 6) {
          moved = false;
          for (let i = 0; i < cur.combo.length; i++) for (const a of grid) {
            if (cur.combo.includes(a)) continue;
            const c2 = [...cur.combo]; c2[i] = a;
            const s = score(c2);
            if (s.key < cur.key - 1e-9) { cur = s; moved = true; }
          }
          // zwei Fräser zugleich durch ein eng benachbartes Paar ersetzen (kleine Knicke entstehen oft so)
          if (si < 2) for (let i = 0; i < cur.combo.length; i++) for (let j = i + 1; j < cur.combo.length; j++) for (const a of grid) for (let d = 1; d <= 4; d++) {
            const b = r2(a + d * step);
            if (b > amax + 1e-9 || exs.has(b)) continue;
            const rest = cur.combo.filter((_, q) => q !== i && q !== j);
            if (rest.includes(a) || rest.includes(b)) continue;
            const s = score([...rest, a, b]);
            if (s.key < cur.key - 1e-9) { cur = s; moved = true; }
          }
        }
        better.push(cur);
      });
      const all = [...better, ...cand.slice(0, 12)].sort((x, y) => x.key - y.key);
      const uniqAll = [], ks = new Set();
      for (const r of all) { const k = r.combo.join('|'); if (!ks.has(k)) { ks.add(k); uniqAll.push(r); } }
      results.push(uniqAll[0]);
      onStep(uniqAll[0], n);
      pools.push(uniqAll.slice(0, 8));
    }
    return { base: score([]), results };
  };

  // runde Radien
  const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
  const niceUp = (v) => { const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; for (const s of STEPS) if (m <= s * 1.0001) return s * e; return 10 * e; };
  const niceDown = (v) => { const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; let b = 1; for (const s of STEPS) if (s <= m * 1.0001) b = s; return b * e; };
  const scenarioRadii = (u, n = 12) => {
    if (!u.length) return [];
    const lo = u[0][0], hi = u[u.length - 1][1];
    const raw = Array.from({ length: n }, (_, k) => lo * Math.pow(hi / lo, k / (n - 1)));
    let vals = raw.map((v, k) => (k === 0 ? niceUp(v) : k === n - 1 || niceUp(v) > hi * 1.0001 ? niceDown(v) : niceUp(v)));
    const inside = (v) => u.some(([a, b]) => v >= a - 1e-6 && v <= b + 1e-6);
    // jeder abgedeckte Bereich bekommt mindestens einen Radius
    for (const [a, b] of u) {
      if (vals.some((v) => v >= a - 1e-6 && v <= b + 1e-6)) continue;
      let v = niceUp(a);
      if (v > b) { const m = Math.sqrt(a * b), e = Math.pow(10, Math.floor(Math.log10(m)) - 1); v = Math.round(m / e) * e; }
      vals.push(v);
    }
    vals = [...new Set(vals.map((v) => Math.round(v * 1000) / 1000))].sort((x, y) => x - y);
    // höchstens n: überzählige nicht abbildbare Radien weglassen
    while (vals.length > n) {
      const i = vals.findIndex((v) => !inside(v));
      if (i < 0) break;
      vals.splice(i, 1);
    }
    return vals;
  };

  // Lamellenkette (Schwalbenschwanz: Grund schmal an der Deckschicht)
  const trap = (alpha, kind, B) => {
    const t = Math.tan(rad(alpha)) * H / 2, h = H / 2;
    const [top, bot] = kind === 'A' ? [B / 2 - t, B / 2 + t] : [B / 2 + t, B / 2 - t];
    return [[-bot, -h], [bot, -h], [top, h], [-top, h]];
  };
  const rot = (a) => [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
  const mul = (R, p) => [R[0][0] * p[0] + R[0][1] * p[1], R[1][0] * p[0] + R[1][1] * p[1]];
  const chain = (aA, aB, n, B, start) => {
    const out = []; let R = rot(start), P = [0, 0];
    const kinds = [['A', aA], ['B', aB]];
    for (let i = 0; i < n; i++) {
      const [k, a] = kinds[i % 2];
      const loc = trap(a, k, B);
      const w = loc.map((q) => { const r = mul(R, q); return [r[0] + P[0], r[1] + P[1]]; });
      out.push({ poly: w, kind: k, a });
      const rb = w[1], rt = w[2];
      const mid = [(rb[0] + rt[0]) / 2, (rb[1] + rt[1]) / 2];
      const dir = Math.atan2(rt[1] - rb[1], rt[0] - rb[0]);
      const [k2, a2] = kinds[(i + 1) % 2];
      const l2 = trap(a2, k2, B);
      const ldir = Math.atan2(l2[3][1] - l2[0][1], l2[3][0] - l2[0][0]);
      R = rot(dir - ldir);
      const lm = [(l2[0][0] + l2[3][0]) / 2, (l2[0][1] + l2[3][1]) / 2];
      const lr = mul(R, lm);
      P = [mid[0] - lr[0], mid[1] - lr[1]];
    }
    return out;
  };
  const backing = (lams, kind) => {
    const pts = [];
    for (const l of lams) {
      if (kind === 'A' && l.kind === 'A') pts.push(l.poly[3], l.poly[2]);
      if (kind === 'B' && l.kind === 'B') pts.push(l.poly[0], l.poly[1]);
    }
    const off = pts.map((p, i) => {
      const j = Math.min(i + 1, pts.length - 1), k = Math.max(i - 1, 0);
      let dx = pts[j][0] - pts[k][0], dy = pts[j][1] - pts[k][1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const s = kind === 'A' ? T : -T;
      return [p[0] - dy * s, p[1] + dx * s];
    });
    return [...pts, ...off.reverse()];
  };
  // Wand für Szenarien: n Lamellen auf ca. 200 mm, mittig ausgerichtet
  const wall = (hi, lo, b, len = 200) => {
    const d = hi - lo, B = bmid(b, hi, lo);
    const n = Math.max(2 * Math.floor((len * 1.05 / B - 1) / 2) + 1, 3);
    const lams = chain(hi, lo, n, B, -rad(Math.floor(n / 2) * d));
    return { lams, backA: backing(lams, 'A'), backB: backing(lams, 'B') };
  };

  return { H, T, AMIN, bmid, radius, bneed, pairs, union, cover, groups, best, covers, search, suggest, widen, optimize, scenarioRadii, chain, backing, wall, uniq };
};
const KV = KVF();
if (typeof module !== 'undefined') module.exports = KV;
