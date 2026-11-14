// ===== Движок раскроя: гильотинный, с пропилом, текстурой и остатками =====
const RK = (function(){
  // Размер заготовки под пилу: готовый размер минус толстая кромка (если включено)
  function cutSize(p, edgeTypes, subtract){
    let L = p.L, W = p.W;
    if(subtract){
      const t = k => { const e = edgeTypes[k]; return e && e.t >= 1 ? e.t : 0; };
      L -= t(p.e.w1) + t(p.e.w2);   // кромка на коротких сторонах укорачивает длину
      W -= t(p.e.l1) + t(p.e.l2);
    }
    return {L: Math.round(L*10)/10, W: Math.round(W*10)/10};
  }

  // Разворачиваем детали в штуки. w - размер вдоль листа (X, вдоль текстуры), h - поперёк
  function expand(parts, mat, opt){
    const items = [];
    parts.forEach(p => {
      const cs = cutSize(p, opt.edgeTypes, opt.subtractEdge);
      let rot;                       // null - можно крутить, false - как есть, true - только повёрнуто
      if(!mat.grain || p.grain === "any") rot = null;
      else rot = p.grain === "across";
      for(let i = 0; i < p.qty; i++) items.push({pid: p.id, n: i+1, w0: cs.L, h0: cs.W, rot});
    });
    return items;
  }

  const SPLITS = {
    H:   () => true,                                   // полосы вдоль листа
    V:   () => false,                                  // полосы поперёк листа
    SLA: (W,H,w,h) => (W-w) < (H-h),                   // короткий остаток
    LLA: (W,H,w,h) => (W-w) >= (H-h),                  // длинный остаток
    MAXA:(W,H,w,h) => w*(H-h) <= h*(W-w),
    MINA:(W,H,w,h) => w*(H-h) > h*(W-w)
  };
  const SCORES = {
    BAF: (W,H,w,h) => W*H - w*h,
    BSSF:(W,H,w,h) => Math.min(W-w, H-h),
    BLSF:(W,H,w,h) => Math.max(W-w, H-h)
  };

  function newSheet(stock, trim){
    const t = stock.offcut ? 0 : trim;
    const root = {x: t, y: t, w: stock.L - 2*t, h: stock.W - 2*t, free: true};
    return {stock, root, free: [root], placed: []};
  }

  function place(sheet, node, it, w, h, rotated, kerf, splitH){
    const {x, y, w: W, h: H} = node;
    sheet.free.splice(sheet.free.indexOf(node), 1);
    node.free = false;
    const part = {x, y, w, h, part: it, rotated};
    sheet.placed.push(part);
    const mk = (x,y,w,h) => { if(w <= 0 || h <= 0) return null; const n = {x,y,w,h,free:true}; sheet.free.push(n); return n; };
    const dw = W - w, dh = H - h;
    let inner;
    if(splitH){
      // сначала рез поперёк всей ширины узла, сверху остаётся полоса во всю ширину
      inner = dw > 0 ? {x, y, w: W, h, cut: {dir: "V", at: x + w, len: h}, kids: [part, mk(x+w+kerf, y, dw-kerf, h)]} : part;
      if(dh > 0){ node.cut = {dir: "H", at: y + h, len: W}; node.kids = [inner, mk(x, y+h+kerf, W, dh-kerf)]; }
      else Object.assign(node, inner === part ? {kids: [part]} : {cut: inner.cut, kids: inner.kids});
    } else {
      inner = dh > 0 ? {x, y, w, h: H, cut: {dir: "H", at: y + h, len: w}, kids: [part, mk(x, y+h+kerf, w, dh-kerf)]} : part;
      if(dw > 0){ node.cut = {dir: "V", at: x + w, len: H}; node.kids = [inner, mk(x+w+kerf, y, dw-kerf, H)]; }
      else Object.assign(node, inner === part ? {kids: [part]} : {cut: inner.cut, kids: inner.kids});
    }
  }

  function packOnce(items, stocks, opt, scoreFn, splitFn, preopen){
    const sheets = [], unplaced = [];
    const avail = stocks.map(s => ({s, left: s.qty == null ? Infinity : s.qty}));
    // вариант "сначала остатки": все остатки со склада сразу лежат на столе
    if(preopen) for(const a of avail) if(a.s.offcut) while(a.left > 0){ sheets.push(newSheet(a.s, opt.trim)); a.left--; }
    const orients = it => it.rot === null ? (it.w0 === it.h0 ? [[it.w0,it.h0,false]] : [[it.w0,it.h0,false],[it.h0,it.w0,true]])
                        : it.rot ? [[it.h0,it.w0,true]] : [[it.w0,it.h0,false]];
    for(const it of items){
      let best = null;
      const os = orients(it);
      for(const sh of sheets) for(const f of sh.free) for(const o of os){
        if(o[0] <= f.w && o[1] <= f.h){
          const sc = scoreFn(f.w, f.h, o[0], o[1]);
          if(!best || sc < best.sc) best = {sc, sh, f, o};
        }
      }
      if(!best){
        // новый лист: сначала остатки (от меньшего), потом целые листы
        for(const a of avail){
          if(a.left <= 0) continue;
          const sh = newSheet(a.s, opt.trim), f = sh.root;
          const o = os.find(o => o[0] <= f.w && o[1] <= f.h);
          if(o){ a.left--; sheets.push(sh); best = {sh, f, o}; break; }
        }
      }
      if(!best){ unplaced.push(it); continue; }
      place(best.sh, best.f, it, best.o[0], best.o[1], best.o[2], opt.kerf, splitFn(best.f.w, best.f.h, best.o[0], best.o[1]));
    }
    return {sheets: sheets.filter(sh => sh.placed.length), unplaced};
  }

  // Оценка: меньше целых листов, меньше площадь сырья, крупнее цельный остаток, меньше резов
  function evaluate(res){
    let full = 0, bigFree = 0, nfree = 0, offA = 0;
    for(const sh of res.sheets){
      if(!sh.stock.offcut) full++; else offA += sh.stock.L * sh.stock.W;
      for(const f of sh.free){ const a = f.w*f.h; if(!sh.stock.offcut && a > bigFree) bigFree = a; nfree++; }
    }
    return [res.unplaced.length, full, -bigFree, nfree, offA];
  }
  const better = (a, b) => { for(let i = 0; i < a.length; i++){ if(a[i] !== b[i]) return a[i] < b[i]; } return false; };

  function rng(seed){ let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  function optimize(parts, mat, opt){
    const items = expand(parts, mat, opt);
    const stocks = (mat.offcuts || []).filter(o => o.qty > 0).map(o => ({L: o.L, W: o.W, qty: o.qty, offcut: true, name: "Остаток " + o.L + "x" + o.W}))
      .sort((a,b) => a.L*a.W - b.L*b.W);
    stocks.push({L: mat.L, W: mat.W, qty: null, offcut: false, name: "Лист " + mat.L + "x" + mat.W});

    const splitKeys = opt.strips === "along" ? ["H"] : opt.strips === "across" ? ["V"] : Object.keys(SPLITS);
    const orders = [
      (a,b) => b.w0*b.h0 - a.w0*a.h0,
      (a,b) => Math.max(b.w0,b.h0) - Math.max(a.w0,a.h0) || Math.min(b.w0,b.h0) - Math.min(a.w0,a.h0),
      (a,b) => Math.min(b.w0,b.h0) - Math.min(a.w0,a.h0) || Math.max(b.w0,b.h0) - Math.max(a.w0,a.h0),
      (a,b) => (b.w0+b.h0) - (a.w0+a.h0),
      (a,b) => b.h0 - a.h0 || b.w0 - a.w0,
      (a,b) => b.w0 - a.w0 || b.h0 - a.h0
    ];
    let best = null, bestEv = null, bestCfg = null, tries = 0;
    const hasOff = stocks.length > 1;
    const consider = (seq, sk, ck) => {
      for(const pre of hasOff ? [false, true] : [false]){
        const r = packOnce(seq, stocks, opt, SCORES[ck], SPLITS[sk], pre); tries++;
        const ev = evaluate(r);
        if(!best || better(ev, bestEv)){ best = r; bestEv = ev; bestCfg = {seq, sk, ck}; }
      }
    };
    for(const ord of orders){
      const seq = items.slice().sort(ord);
      for(const sk of splitKeys) for(const ck of Object.keys(SCORES)) consider(seq, sk, ck);
    }
    // Случайные перестановки вокруг лучшего порядка, пока есть время
    const t0 = Date.now(), budget = opt.timeMs == null ? 700 : opt.timeMs, rnd = rng(12345);
    const cks = Object.keys(SCORES);
    const maxTries = opt.maxTries || Infinity;
    while(items.length > 2 && tries < maxTries && Date.now() - t0 < budget){
      const seq = bestCfg.seq.slice(), n = seq.length, moves = 1 + Math.floor(rnd()*3);
      for(let m = 0; m < moves; m++){
        const i = Math.floor(rnd()*n), j = Math.floor(rnd()*n);
        const t = seq[i]; seq[i] = seq[j]; seq[j] = t;
      }
      consider(seq, splitKeys[Math.floor(rnd()*splitKeys.length)], cks[Math.floor(rnd()*cks.length)]);
    }
    return finish(best, mat, opt, tries);
  }

  // Убираем лишние резы: если обе части после реза пустые - это один цельный кусок
  function collapse(n){
    if(!n || !n.kids) return;
    n.kids.forEach(collapse);
    const kids = n.kids.filter(Boolean);
    if(kids.length && kids.every(k => k.free)){ delete n.cut; delete n.kids; n.free = true; }
  }

  function finish(res, mat, opt, tries){
    const out = {mat, sheets: [], unplaced: res.unplaced, tries, totals: {}};
    let stockArea = 0, partArea = 0, usefulArea = 0, cutLen = 0, cutN = 0;
    for(const sh of res.sheets){
      collapse(sh.root);
      const cuts = [], free = [];
      const t = sh.stock.offcut ? 0 : opt.trim;
      if(t > 0){   // обрезка кромки листа
        const {L, W} = sh.stock;
        cuts.push({dir:"H", x: 0, y: t, len: L, trim: true}, {dir:"V", x: t, y: t, len: W - t, trim: true},
                  {dir:"H", x: t, y: W - t, len: L - t, trim: true}, {dir:"V", x: L - t, y: t, len: W - 2*t, trim: true});
      }
      (function walk(n){
        if(!n) return;
        if(n.free){ free.push(n); return; }
        if(n.cut){
          cuts.push(n.cut.dir === "H" ? {dir:"H", x: n.x, y: n.cut.at, len: n.cut.len} : {dir:"V", x: n.cut.at, y: n.y, len: n.cut.len});
        }
        (n.kids || []).forEach(walk);
      })(sh.root);
      const offcuts = free.map(f => {
        const a = Math.max(f.w, f.h), b = Math.min(f.w, f.h);
        return {x: f.x, y: f.y, w: f.w, h: f.h, useful: a >= opt.minOffL && b >= opt.minOffW};
      });
      const sArea = sh.stock.L * sh.stock.W;
      const pArea = sh.placed.reduce((s,p) => s + p.w*p.h, 0);
      const uArea = offcuts.filter(o => o.useful).reduce((s,o) => s + o.w*o.h, 0);
      const cl = cuts.reduce((s,c) => s + c.len, 0);
      stockArea += sArea; partArea += pArea; usefulArea += uArea; cutLen += cl; cutN += cuts.length;
      const sig = sh.stock.L + "x" + sh.stock.W + "|" + sh.placed.map(p => [p.part.pid, p.x, p.y, p.w, p.h].join(",")).sort().join(";");
      out.sheets.push({stock: sh.stock, trim: t, placed: sh.placed, cuts, offcuts, sig, count: 1,
        used: pArea / sArea, pArea, sArea, uArea, cutLen: cl});
    }
    // Одинаковые карты объединяем: "x2"
    const merged = [];
    for(const s of out.sheets){
      const m = merged.find(q => q.sig === s.sig);
      if(m) m.count++; else merged.push(s);
    }
    out.sheets = merged;
    out.totals = {
      sheets: res.sheets.filter(s => !s.stock.offcut).length,
      offcutsUsed: res.sheets.filter(s => s.stock.offcut).length,
      stockArea, partArea, usefulArea, cutLen, cutN,
      used: stockArea ? partArea / stockArea : 0,
      waste: stockArea ? (stockArea - partArea - usefulArea) / stockArea : 0
    };
    return out;
  }

  return {optimize, cutSize};
})();
if(typeof module !== "undefined") module.exports = RK;
