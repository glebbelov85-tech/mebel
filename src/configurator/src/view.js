// ============================================================
// 2. РИСУНКИ МАТЕРИАЛОВ (без картинок из сети) И 3D-СЦЕНА
// ============================================================
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hexRgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgba(h, a) { const c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
function shade(h, k) { const c = hexRgb(h).map(v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))))); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); }

// Рисует декор на холсте. kind: solid | wood | marble | stone | concrete | terrazzo | planks | tile
const TEX_CACHE = {};
function texCanvas(kind, color, dark, light, size) {
  const key = [kind, color, dark, light, size].join("|");
  if (TEX_CACHE[key]) return TEX_CACHE[key];
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), r = rng(hashStr(key)), S = size;
  dark = dark || shade(color, -0.3); light = light || shade(color, 0.3);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  const streaks = (n, amp) => {
    for (let i = 0; i < n; i++) {
      const x = r() * S, w = 0.4 + r() * r() * S / 70, dk = r() < 0.6;
      g.strokeStyle = dk ? rgba(dark, 0.05 + r() * 0.2) : rgba(light, 0.05 + r() * 0.2);
      g.lineWidth = w;
      const a1 = (r() - 0.5) * S * amp, k1 = 1 + (r() * 2 | 0), p1 = r() * 6.283, a2 = (r() - 0.5) * S * amp * 0.5, p2 = r() * 6.283;
      for (const off of [-S, 0, S]) {
        g.beginPath();
        for (let y = 0; y <= S; y += S / 32) { const xx = x + off + a1 * Math.sin(y / S * 6.283 * k1 + p1) + a2 * Math.sin(y / S * 6.283 * 3 + p2); y === 0 ? g.moveTo(xx, y) : g.lineTo(xx, y); }
        g.stroke();
      }
    }
  };
  const specks = (n, cols, rmin, rmax, amin, amax) => {
    for (let i = 0; i < n; i++) { g.fillStyle = rgba(cols[r() * cols.length | 0], amin + r() * (amax - amin)); const rad = rmin + r() * r() * (rmax - rmin); g.beginPath(); g.arc(r() * S, r() * S, rad, 0, 6.283); g.fill(); }
  };
  const clouds = (n, cols, a) => {
    for (let i = 0; i < n; i++) { const x = r() * S, y = r() * S, rad = S * (0.08 + r() * 0.25), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(cols[r() * cols.length | 0], a)); gr.addColorStop(1, rgba(color, 0)); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  };
  if (kind === "wood" || kind === "planks") {
    for (let i = 0; i < 7; i++) { const x = r() * S, w = S * (0.05 + r() * 0.16); const gr = g.createLinearGradient(x, 0, x + w, 0); const col = r() < 0.5 ? dark : light; gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, 0.1 + r() * 0.1)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x, 0, w, S); }
    streaks(S * 0.55, 0.012);
    specks(S * 2, [dark], 0.3, 0.9, 0.05, 0.16);
    if (kind === "planks") {
      const n = 4, pw = S / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = rgba(r() < 0.5 ? dark : light, r() * 0.14); g.fillRect(i * pw, 0, pw, S);
        g.fillStyle = rgba(dark, 0.55); g.fillRect(i * pw, 0, Math.max(1, S / 256), S);
        const y = r() * S; g.fillRect(i * pw, y, pw, Math.max(1, S / 256));
      }
    }
  } else if (kind === "marble") {
    clouds(26, [dark, light], 0.05);
    for (let i = 0; i < 7; i++) {
      let x = r() * S, y = -10; const dx = (r() - 0.5) * 1.4;
      const pts = [[x, y]]; while (y < S + 10) { x += (dx + (r() - 0.5) * 1.2) * S / 14; y += S / 14 * (0.5 + r()); pts.push([x, y]); }
      for (const [lw, al] of [[S / 30, 0.05], [S / 110, 0.16], [Math.max(0.7, S / 420), 0.38]]) for (const off of [-S, 0, S]) {
        g.strokeStyle = rgba(dark, al * (0.5 + r() * 0.5)); g.lineWidth = lw; g.lineJoin = "round"; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] + off, p[1]) : g.moveTo(p[0] + off, p[1])); g.stroke();
      }
    }
    specks(S, [dark], 0.3, 0.8, 0.03, 0.1);
  } else if (kind === "concrete") {
    clouds(60, [dark, light], 0.07);
    specks(S * 3, [dark, light, "#000000"], 0.3, 1.1, 0.04, 0.14);
  } else if (kind === "stone") {
    clouds(20, [dark, light], 0.05);
    specks(S * 6, [dark, light, "#ffffff", "#000000"], 0.3, S / 260, 0.1, 0.45);
  } else if (kind === "terrazzo") {
    const cols = [dark, light, "#2f3a40", "#c9b79c", "#ffffff", "#8a8f93"];
    for (let i = 0; i < S * 0.9; i++) {
      const x = r() * S, y = r() * S, rad = S / 200 + r() * r() * S / 38, n = 5 + (r() * 3 | 0), a0 = r() * 6.283;
      g.fillStyle = rgba(cols[r() * cols.length | 0], 0.55 + r() * 0.4);
      g.beginPath(); for (let j = 0; j < n; j++) { const a = a0 + j / n * 6.283, rr = rad * (0.6 + r() * 0.6); j ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
    }
  } else if (kind === "tile") {
    clouds(30, [dark, light], 0.05);
    g.fillStyle = rgba(dark, 0.5); const lw = Math.max(1, S / 170);
    g.fillRect(0, 0, S, lw); g.fillRect(0, 0, lw, S); g.fillRect(0, S / 2, S, lw); g.fillRect(S / 2, 0, lw, S);
  }
  return (TEX_CACHE[key] = c);
}
const THUMB = {};
function swatchCss(m) {
  const k = m.texture && m.texture.kind || "solid";
  if (k === "solid") return "background:" + m.color;
  if (k === "mirror") return "background:linear-gradient(135deg," + shade(m.color, 0.55) + " 0%," + m.color + " 45%," + shade(m.color, 0.35) + " 55%," + shade(m.color, -0.15) + " 100%)";
  const key = k + m.color;
  if (!THUMB[key]) THUMB[key] = texCanvas(k, m.color, m.texture.dark, m.texture.light, 96).toDataURL("image/jpeg", 0.8);
  return "background:" + m.color + " url(" + THUMB[key] + ") center/cover";
}
const FLOORS = {
  oak:   { n: "Светлый паркет", k: "planks", c: "#c9ac82", d: "#8f6f48", l: "#e0c9a4", mm: 1100 },
  dark:  { n: "Тёмный паркет",  k: "planks", c: "#6f4f38", d: "#3c2618", l: "#8d6a4f", mm: 1100 },
  tile:  { n: "Серая плитка",   k: "tile",   c: "#c9c8c4", d: "#96958f", l: "#e2e1dd", mm: 1200 },
  beige: { n: "Бежевая плитка", k: "tile",   c: "#ddd2c0", d: "#ad9f89", l: "#eee6d8", mm: 1200 }
};
const WALLS = { "#e9e6df": "Белые", "#d9d3c5": "Бежевые", "#c8cec6": "Серо-зелёные", "#bcc5cf": "Серо-голубые", "#d7c2b4": "Пудровые" };

const THREE_URLS = ["https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js", "https://unpkg.com/three@0.180.0/build/three.module.min.js"];

const View = (() => {
  let T, host, renderer, scene, camera, productG, roomG, catcher, sun, dirty = true, photo = null, photoImg = null;
  let cam = { az: 0.5, el: 0.2, dist: 6000, tx: 0, ty: 1000, tz: 0 }, goal = null, bounds = null, lastKey = "", data = null, open = false;
  const mats = {}, texs = {};
  const api = { ok: false, onPick: null, onMove: null };

  async function load() {
    let err;
    for (const u of (window.THREE_LOCAL ? [window.THREE_LOCAL] : THREE_URLS)) { try { return await import(u); } catch (e) { err = e; } }
    throw err;
  }

  api.init = async function (el) {
    host = el;
    T = await load();
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = T.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(36, 1, 50, 60000);

    // окружение для отражений: светлая комната с окнами-светильниками
    const env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(10, 6, 10), new T.MeshBasicMaterial({ color: 0x8d8b86, side: T.BackSide })));
    const lamp = (x, y, z, w, h, ry, rx, k) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(k, k * 0.97, k * 0.92), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); env.add(m); };
    lamp(0, 2.95, 0, 5, 5, 0, Math.PI / 2, 2.2); lamp(0, -1.6, 4.95, 10, 2.6, 0, 0, 0.55); lamp(-2.5, 1.2, 4.94, 3, 2.6, 0, 0, 1.6); lamp(-4.9, 0.5, 1, 4, 3, Math.PI / 2, 0, 6); lamp(2, 0.5, 4.9, 5, 3, 0, 0, 3.5); lamp(4.9, 0, -1, 2, 2, Math.PI / 2, 0, 1.5);
    const floorE = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshBasicMaterial({ color: 0x6b6258 })); floorE.rotation.x = -Math.PI / 2; floorE.position.y = -2.95; env.add(floorE);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
    scene.environmentIntensity = 0.5;

    scene.add(new T.HemisphereLight(0xffffff, 0xb9b0a2, 0.4));
    sun = new T.DirectionalLight(0xfff4e6, 2.1);
    sun.castShadow = true; sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 6; sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);
    productG = new T.Group(); roomG = new T.Group(); scene.add(productG, roomG);
    catcher = new T.Mesh(new T.PlaneGeometry(30000, 30000), new T.ShadowMaterial({ opacity: 0.32 }));
    catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; catcher.visible = false; scene.add(catcher);

    controls();
    new ResizeObserver(resize).observe(host); resize();
    (function loop(t) {
      requestAnimationFrame(loop);
      if (goal) {
        const k = Math.min(1, (performance.now() - goal.t0) / 450), e = 1 - Math.pow(1 - k, 3);
        for (const p of ["az", "el", "dist", "tx", "ty", "tz"]) cam[p] = goal.from[p] + (goal.to[p] - goal.from[p]) * e;
        if (k >= 1) goal = null; dirty = true;
      }
      if (dirty) { dirty = false; place(); renderer.render(scene, camera); }
    })();
    api.ok = true;
    if (data) api.update(data, true);
  };

  function resize() {
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    renderer.setSize(w, h, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
    camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  function place() {
    const ce = Math.cos(cam.el);
    camera.position.set(cam.tx + cam.dist * Math.sin(cam.az) * ce, cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.az) * ce);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }

  function controls() {
    const el = renderer.domElement, pts = new Map(); let last = null, down = null, moved = false;
    el.style.touchAction = "none";
    const mid = () => { const a = [...pts.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
    const pan = (dx, dy) => {
      const k = cam.dist * Math.tan(camera.fov * Math.PI / 360) * 2 / el.clientHeight;
      const rx = Math.cos(cam.az), rz = -Math.sin(cam.az);
      cam.tx -= dx * k * rx; cam.tz -= dx * k * rz; cam.ty += dy * k * Math.cos(cam.el);
    };
    el.addEventListener("pointerdown", e => {
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button, shift: e.shiftKey }; moved = false; }
      if (pts.size === 2) last = mid();
      goal = null;
    });
    el.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) moved = true;
        if (down && (down.btn === 2 || down.shift || api.panMode)) pan(dx, dy);
        else { cam.az -= dx * 0.006; cam.el += dy * 0.005; }
      } else if (pts.size === 2) {
        const m = mid(); if (last) { cam.dist *= last.d / Math.max(20, m.d); pan(m.x - last.x, m.y - last.y); } last = m; moved = true;
      }
      clamp(); dirty = true; if (api.onMove) api.onMove();
    });
    const up = e => {
      if (pts.size === 1 && down && !moved && performance.now() - down.t < 400) pick(e);
      pts.delete(e.pointerId); last = null; if (!pts.size) down = null;
    };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", e => { pts.delete(e.pointerId); last = null; });
    el.addEventListener("wheel", e => { e.preventDefault(); cam.dist *= Math.exp(e.deltaY * 0.0012); goal = null; clamp(); dirty = true; if (api.onMove) api.onMove(); }, { passive: false });
    el.addEventListener("contextmenu", e => e.preventDefault());
  }
  function clamp() {
    cam.el = Math.max(photo ? -0.1 : 0.02, Math.min(1.3, cam.el));
    if (!photo) cam.az = Math.max(-1.45, Math.min(1.45, cam.az));
    const d0 = bounds ? bounds.r : 3000; cam.dist = Math.max(d0 * 0.5, Math.min(d0 * 6, cam.dist));
  }
  function pick(e) {
    const rc = renderer.domElement.getBoundingClientRect(), v = new T.Vector2((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(v, camera);
    const hit = ray.intersectObjects(productG.children, true).find(h => h.object.isMesh);
    if (!hit) return;
    if (hit.object.userData.door !== undefined) api.onPick(hit.object.userData.door);
    else { let o = hit.object; while (o && !o.userData.slot) o = o.parent; if (o && api.onPickMod) api.onPickMod(o.userData.slot); }
  }

  // ---------- материалы ----------
  function texture(kind, color, dark, light, mm) {
    const key = [kind, color, dark, light].join("|");
    if (!texs[key]) {
      const t = new T.CanvasTexture(texCanvas(kind, color, dark, light, 512));
      t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.userData.mm = mm; texs[key] = t;
    }
    return texs[key];
  }
  const TEX_MM = { wood: 900, marble: 1400, stone: 500, concrete: 1100, terrazzo: 600 };
  const nmaps = {};
  function normalTex(style) {
    if (nmaps[style]) return nmaps[style];
    const c = document.createElement("canvas"); c.width = 64; c.height = 4; const g = c.getContext("2d");
    for (let x = 0; x < 64; x++) {
      const u = (x + 0.5) / 64; let nx;
      if (style === "fluted") nx = (2 * u - 1) * 0.88;
      else nx = u < 0.1 ? -0.85 : u > 0.9 ? 0.85 : 0;
      const nz = Math.sqrt(1 - nx * nx);
      g.fillStyle = "rgb(" + Math.round((nx * 0.5 + 0.5) * 255) + ",128," + Math.round((nz * 0.5 + 0.5) * 255) + ")"; g.fillRect(x, 0, 1, 4);
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return (nmaps[style] = t);
  }
  const PITCH = { fluted: 22, slats: 62 };
  function ribbed(base, style) {
    const key = base.uuid + style;
    if (mats[key]) return mats[key];
    const m = base.clone(), nt = normalTex(style).clone(); nt.needsUpdate = true;
    const mm = base.userData.mm || PITCH[style] * 6;
    nt.repeat.set(mm / PITCH[style], 1); m.normalMap = nt; m.normalScale = new T.Vector2(1.1, 1.1); m.userData = { mm };
    return (mats[key] = m);
  }
  function matFor(m) {
    const kind = m.texture && m.texture.kind || (/^mirror/.test(m.id) ? "mirror" : "solid");
    const key = [m.id, m.color, kind, m.gloss ? 1 : 0].join("|");
    if (mats[key]) return mats[key];
    let mat;
    if (kind === "mirror" || /^mirror/.test(m.id)) mat = new T.MeshStandardMaterial({ color: new T.Color(m.color).lerp(new T.Color(0xffffff), 0.45), metalness: 1, roughness: 0.02, envMapIntensity: 3 });
    else if (m.group === "glass") mat = new T.MeshPhysicalMaterial({ color: m.color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 });
    else {
      const rough = m.gloss ? (m.group === "top" || m.group === "apron" ? 0.22 : 0.13) : m.group === "mdf" ? (m.id === "mdf18-enamel" ? 0.38 : 0.55) : m.group === "top" || m.group === "apron" ? 0.5 : m.group === "dvp" ? 0.85 : 0.66;
      const p = { roughness: rough, metalness: 0, envMapIntensity: m.gloss ? 1.3 : 1 };
      if (kind === "solid") p.color = m.color || "#cccccc";
      else p.map = texture(kind, m.color, m.texture.dark, m.texture.light, TEX_MM[kind] || 900);
      mat = m.gloss && m.group !== "top" && m.group !== "apron" ? new T.MeshPhysicalMaterial(Object.assign(p, { clearcoat: 0.8, clearcoatRoughness: 0.04, roughness: 0.3 })) : new T.MeshStandardMaterial(p);
    }
    mat.userData.mm = mat.map ? mat.map.userData.mm : 0;
    return (mats[key] = mat);
  }
  const plain = {}, lines = {};
  function lineMat(color) { return lines[color] || (lines[color] = new T.LineBasicMaterial({ color: new T.Color(color || "#888").multiplyScalar(0.45), transparent: true, opacity: 0.55 })); }
  function flat(color, rough, metal) { const k = color + rough + metal; return plain[k] || (plain[k] = new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal || 0, envMapIntensity: metal > 0.5 ? 2.4 : 1 })); }

  // коробка с развёрткой рисунка по размерам в мм, grain - ось волокон (x|y|z)
  function box(dx, dy, dz, mat, grain, seed) {
    const g = new T.BoxGeometry(dx, dy, dz);
    const mm = mat.userData.mm;
    if (mm) {
      const uv = g.attributes.uv, r = rng(seed * 7919 + 13), ou = r(), ov = r();
      const F = [["z", dz, dy], ["z", dz, dy], ["x", dx, dz], ["x", dx, dz], ["x", dx, dy], ["x", dx, dy]];
      const VA = ["y", "y", "z", "z", "y", "y"];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const j = f * 4 + i; let U = uv.getX(j) * F[f][1] / mm, V = uv.getY(j) * F[f][2] / mm;
        if (grain === F[f][0] && grain !== VA[f]) { const t = U; U = V; V = t; }
        uv.setXY(j, U + ou, V + ov);
      }
    }
    const mesh = new T.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  function put(group, mesh, x, y, z) { mesh.position.set(x, y, z); group.add(mesh); return mesh; }
  const GRAIN = { X: { a: "y", b: "z", any: "y" }, Y: { a: "x", b: "z", any: "x" }, Z: { a: "x", b: "y", any: "y" } };

  function addPart(order, product, group, part, idx, ctx) {
    const m = MO.getMaterial(order, product, part.mat); if (!m || !(part.a > 0 && part.b > 0) || !GRAIN[part.o]) return;
    if (typeof part.x !== "number") return;
    if (part.role === "drawer" && !ctx.showInside) return;
    if (part.door !== undefined && open) return;
    const d = MO.partDims(part, m.t || 16);
    const fz = part.role === "facade" && part.o === "Z", stl = fz && m.group === "mdf" && part.a > 120 && part.b > 120 ? ctx.style : "flat";
    const mat = PITCH[stl] ? ribbed(matFor(m), stl) : matFor(m);
    const mesh = put(group, box(d[0], d[1], d[2], mat, GRAIN[part.o][MO.partGrain(part, m)], idx), part.x + d[0] / 2, part.y + d[1] / 2, part.z + d[2] / 2);
    if (part.door !== undefined) mesh.userData.door = part.door;
    if (part.role !== "facade" || part.o !== "Z") return;
    const zf = part.z + d[2];
    const FW = { shaker: 58, slim: 24, classic: 66 }, fw = FW[stl], shk = !!fw && part.a > 190 && part.b > 190;
    if (m.group !== "glass") {
      const eg = new T.BoxGeometry(d[0], d[1], d[2] + (shk ? 3.6 : 0));
      const ln = new T.LineSegments(new T.EdgesGeometry(eg), lineMat(m.color)); eg.dispose();
      ln.position.copy(mesh.position); if (shk) ln.position.z += 1.8; group.add(ln);
    }
    if (shk) {
      const ft = 3.5;
      if (stl === "classic") put(group, box(part.a - 2 * fw - 44, part.b - 2 * fw - 44, 2.6, mat, "y", idx + 5), part.x + part.a / 2, part.y + part.b / 2, zf + 1.3);
      put(group, box(fw, part.b, ft, mat, "y", idx + 1), part.x + fw / 2, part.y + part.b / 2, zf + ft / 2);
      put(group, box(fw, part.b, ft, mat, "y", idx + 2), part.x + part.a - fw / 2, part.y + part.b / 2, zf + ft / 2);
      put(group, box(part.a - 2 * fw, fw, ft, mat, "x", idx + 3), part.x + part.a / 2, part.y + fw / 2, zf + ft / 2);
      put(group, box(part.a - 2 * fw, fw, ft, mat, "x", idx + 4), part.x + part.a / 2, part.y + part.b - fw / 2, zf + ft / 2);
    }
    if (part.handle && ctx.handles === "std" && ctx.handle) {
      const hi = ctx.handle, hm = flat((HANDLE_COLOR[hi.color] || HANDLE_COLOR.steel).c, 0.35, 0.9), h = part.handle, zz = zf + (shk ? 3.5 : 0);
      const M = (geo, x, y, z, rz, rx) => { const b = new T.Mesh(geo, hm); b.castShadow = true; if (rz) b.rotation.z = rz; if (rx) b.rotation.x = rx; return put(group, b, x, y, z); };
      const tall = part.b > 1100, vert = h.side !== "c";
      const dim = vert ? part.b : part.a, len = Math.max(20, Math.min(hi.len || 160, dim * (hi.kind === "rail" ? 0.8 : 0.6)));
      const off = hi.kind === "knob" ? 0 : len / 2;
      const cx = h.side === "c" ? part.x + part.a / 2 : h.side === "r" ? part.x + part.a - 38 : part.x + 38;
      const cy = h.side === "c" ? (h.at === "t" ? part.y + part.b - Math.min(50, part.b / 2) : part.y + Math.min(50, part.b / 2))
        : tall ? (h.at === "t" ? part.y + part.b - 250 - off : part.y + 250 + off) : (h.at === "t" ? part.y + part.b - 60 - off : part.y + 60 + off);
      if (hi.kind === "knob") { M(new T.CylinderGeometry(15, 12, 8, 20), cx, cy, zz + 22, 0, Math.PI / 2); M(new T.CylinderGeometry(6, 8, 20, 12), cx, cy, zz + 10, 0, Math.PI / 2); }
      else if (hi.kind === "shell") { M(new T.BoxGeometry(vert ? 26 : len, vert ? len : 26, 6), cx, cy, zz + 19); M(new T.BoxGeometry(vert ? 6 : len, vert ? len : 6, 18), cx + (vert ? (h.side === "r" ? -10 : 10) : 0), cy + (vert ? 0 : 10), zz + 9); }
      else if (hi.kind === "edge") {
        if (tall) { const ex = h.side === "r" ? part.x + part.a - 2 : part.x + 2; M(new T.BoxGeometry(5, len, 30), ex, cy, zz + 6); }
        else { const ex = h.side === "c" ? cx : h.side === "r" ? part.x + part.a - len / 2 - 18 : part.x + len / 2 + 18, ey = h.at === "t" ? part.y + part.b - 2 : part.y + 2; M(new T.BoxGeometry(len, 5, 30), ex, ey, zz + 6); }
      } else {
        const rail = hi.kind === "rail";
        if (rail) M(new T.CylinderGeometry(6, 6, len, 12), cx, cy, zz + 30, vert ? 0 : Math.PI / 2);
        else M(new T.BoxGeometry(vert ? 10 : len, vert ? len : 10, 10), cx, cy, zz + 27);
        const inset = rail ? Math.min(40, len * 0.15) : 14;
        for (const sg of [-1, 1]) M(new T.BoxGeometry(8, 8, rail ? 28 : 24), cx + (vert ? 0 : sg * (len / 2 - inset)), cy + (vert ? sg * (len / 2 - inset) : 0), zz + (rail ? 14 : 12));
      }
    }
  }

  function kitchenExtras(g, m, ctx, order, product) {
    const { PL, Hl, Dl, Du, TOP_Y } = KD, w = m.size.w, kind = m.kind, top = TOP_Y + ctx.topT;
    const fac = matFor(MO.getMaterial(order, product, "@facade")), steel = flat("#b9bcc0", 0.3, 0.9), glass = flat("#101214", 0.08, 0.3), dark = flat("#1b1c1e", 0.5, 0.2);
    const B = (dx, dy, dz, mat, x, y, z, noShadow) => { const b = new T.Mesh(new T.BoxGeometry(dx, dy, dz), mat); b.castShadow = !noShadow; b.receiveShadow = true; return put(g, b, x, y, z); };
    if (kind.indexOf("lower-") === 0 && kind !== "lower-gap") {
      B(w, PL - 4, 16, fac, w / 2, (PL - 4) / 2, Dl - 45);
      if (ctx.handles === "gola" && !LOWER[kind.slice(6)].tall) B(w, 26, 6, dark, w / 2, PL + Hl - 13, Dl + 16.5, true);
    }
    if (kind === "lower-sink") {
      B(Math.min(460, w - 120), 6, 400, steel, w / 2, top + 2, 300, true);
      B(Math.min(400, w - 180), 4, 340, flat("#6f7377", 0.4, 0.9), w / 2, top + 4.5, 300, true);
      const c = new T.Mesh(new T.CylinderGeometry(11, 13, 260, 16), steel); c.castShadow = true; put(g, c, w / 2, top + 130, 70);
      B(18, 14, 170, steel, w / 2, top + 255, 150);
    }
    if (kind === "lower-oven" || (kind === "lower-gap" && m.params.what === "stove")) {
      if (kind === "lower-oven") { B(w - 6, Hl - 126, 20, glass, w / 2, PL + 120 + (Hl - 120) / 2, Dl + 10); B(w - 120, 12, 12, steel, w / 2, PL + Hl - 60, Dl + 40); B(Math.min(580, w - 20), 6, 500, glass, w / 2, top + 3, 300, true); }
      else { B(w - 12, 850, 590, flat("#e9eaea", 0.4, 0.1), w / 2, 425, 300); B(w - 30, 430, 8, glass, w / 2, 400, 598); B(w - 140, 12, 12, steel, w / 2, 650, 625); B(w - 12, 8, 590, glass, w / 2, 854, 300, true); }
      for (const [ix, iz, rr] of [[-0.22, -0.2, 70], [0.22, -0.2, 90], [-0.22, 0.2, 90], [0.22, 0.2, 70]]) { const r = new T.Mesh(new T.RingGeometry(rr - 4, rr, 28), flat("#5a5d61", 0.4, 0.2)); r.rotation.x = -Math.PI / 2; put(g, r, w / 2 + ix * w, (kind === "lower-oven" ? top + 6.6 : 858.6), 300 + iz * 500 / 0.8 * 0.8); }
    }
    if (kind === "lower-gap" && m.params.what === "fridge") {
      B(w - 20, 1850, 620, flat("#d3d6d9", 0.4, 0.55), w / 2, 925, 320); B(w - 20, 4, 4, dark, w / 2, 700, 632, true);
      B(14, 320, 14, flat("#8d9094", 0.3, 0.9), 45, 900, 640); B(14, 260, 14, flat("#8d9094", 0.3, 0.9), 45, 500, 640);
    }
    if (kind === "lower-tallOven") { B(w - 6, 590, 20, glass, w / 2, PL + 500 + 300, Dl + 10); B(w - 120, 12, 12, steel, w / 2, PL + 1040, Dl + 40); B(w - 6, 372, 20, glass, w / 2, PL + 1104 + 186, Dl + 10); B(w - 6, 6, 20, steel, w / 2, PL + 1099, Dl + 10); }
    if (kind === "upper-hood") B(w - 6, 36, Du - 10, steel, w / 2, ctx.upTop - 360 - 18, Du / 2 + 5);
    if (kind.indexOf("upper-") === 0 && ctx.led && kind !== "upper-hood") B(w - 60, 4, 10, ctx.ledMat, w / 2, ctx.upY - 2, Du - 50, true);
  }

  function kupeExtras(g, ctx) {
    const geo = ctx.geom, pm = flat(ctx.profColor, 0.35, 0.85), chrome = flat("#c9ccd0", 0.25, 1);
    const B = (dx, dy, dz, mat, x, y, z, door) => { const b = new T.Mesh(new T.BoxGeometry(dx, dy, dz), mat); b.castShadow = true; b.receiveShadow = true; if (door !== undefined) b.userData.door = door; return put(g, b, x, y, z); };
    ctx.rods.forEach(r => { const c = new T.Mesh(new T.CylinderGeometry(12, 12, r.len, 14), chrome); c.rotation.z = Math.PI / 2; c.castShadow = true; put(g, c, r.x + r.len / 2, r.y, r.z); });
    B(geo.inW, 6, 84, pm, geo.x0 + geo.inW / 2, geo.yb + 3, geo.Dk + geo.BK + 50); B(geo.inW, 40, 84, pm, geo.x0 + geo.inW / 2, geo.yt - 20, geo.Dk + geo.BK + 50);
    if (open) return;
    geo.doorRects.forEach((d, j) => {
      const zc = d.z + 8;
      B(26, d.h, 20, pm, d.x + 13, d.y + d.h / 2, zc, j); B(26, d.h, 20, pm, d.x + d.w - 13, d.y + d.h / 2, zc, j);
      B(d.w - 52, 36, 16, pm, d.x + d.w / 2, d.y + 18, zc, j); B(d.w - 52, 36, 16, pm, d.x + d.w / 2, d.y + d.h - 18, zc, j);
      if (d.fill === "combo") B(d.w - 52, 12, 16, pm, d.x + d.w / 2, d.y + 36 + Math.round((d.h - 72) * 0.5), zc, j);
      if (ctx.selDoor === j) { const o = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(d.w + 8, d.h + 8, 30)), new T.LineBasicMaterial({ color: 0x1f6b57 })); put(g, o, d.x + d.w / 2, d.y + d.h / 2, zc); }
    });
  }

  function buildRoom(ctx, bb) {
    while (roomG.children.length) { const c = roomG.children.pop(); if (c.geometry) c.geometry.dispose(); }
    const fl = FLOORS[ctx.room.floor] || FLOORS.oak, ft = texture(fl.k, fl.c, fl.d, fl.l, fl.mm);
    const x0 = ctx.wallL ? 0 : bb.min.x - 3500, x1 = ctx.wallR ? bb.max.x : bb.max.x + 3500, depth = Math.max(bb.max.z + 3200, 4200), H = 3800;
    const fm = plain["fl" + ctx.room.floor] || (plain["fl" + ctx.room.floor] = new T.MeshStandardMaterial({ map: ft, roughness: 0.55 }));
    const plane = (w, h, mat, mm) => { const g = new T.PlaneGeometry(w, h); if (mm) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / mm, uv.getY(i) * h / mm); } const m = new T.Mesh(g, mat); m.receiveShadow = true; return m; };
    const fw = x1 - x0, f = plane(fw, depth + 1500, fm, fl.mm); f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0, (depth + 1500) / 2 - (ctx.wallL || ctx.wallR ? 0 : 0)); roomG.add(f);
    const wm = flat(ctx.room.wall, 0.92, 0);
    const bw = plane(x1 - x0 + (ctx.wallL ? 0 : 1500) + (ctx.wallR ? 0 : 1500), H, wm); bw.position.set((x0 - (ctx.wallL ? 0 : 1500) + x1 + (ctx.wallR ? 0 : 1500)) / 2, H / 2, 0); roomG.add(bw);
    if (ctx.wallL) { const l = plane(depth, H, wm); l.rotation.y = Math.PI / 2; l.position.set(0, H / 2, depth / 2); roomG.add(l); }
    if (ctx.wallR) { const r = plane(depth, H, wm); r.rotation.y = -Math.PI / 2; r.position.set(bb.max.x, H / 2, depth / 2); roomG.add(r); }
    const sk = flat("#f4f2ee", 0.7, 0);
    const skb = new T.Mesh(new T.BoxGeometry(bw.geometry.parameters.width, 70, 12), sk); skb.position.set(bw.position.x, 35, 6); skb.receiveShadow = true; roomG.add(skb);
  }

  api.update = function (d, refit) {
    data = d; if (!api.ok) return;
    const { order, ctx } = d;
    productG.traverse(o => { if (o.geometry) o.geometry.dispose(); }); productG.clear();
    if (ctx.led) ctx.ledMat = plain.led || (plain.led = new T.MeshBasicMaterial({ color: new T.Color(3, 2.6, 1.9) }));
    let idx = 0;
    (order.products || []).forEach(product => {
      const root = new T.Group(); productG.add(root);
      (product.parts || []).forEach(p => addPart(order, product, root, p, ++idx, ctx));
      (product.modules || []).forEach(m => {
        const g = new T.Group(); g.position.set(m.pos.x || 0, m.pos.y || 0, m.pos.z || 0); g.rotation.y = (m.rot || 0) * Math.PI / 180; root.add(g); if (m.slot) g.userData.slot = m.slot;
        (m.parts || []).forEach(p => addPart(order, product, g, p, ++idx, ctx));
        if (ctx.type === "kitchen" && m.kind) kitchenExtras(g, m, ctx, order, product);
      });
      if (ctx.type === "kupe") kupeExtras(root, ctx);
    });
    const bb = new T.Box3().setFromObject(productG);
    if (bb.isEmpty()) bb.set(new T.Vector3(0, 0, 0), new T.Vector3(1000, 1000, 500));
    const size = bb.getSize(new T.Vector3());
    bounds = { bb, r: Math.max(size.x, size.y, size.z, 1200) };
    buildRoom(ctx, bb);
    const c = bb.getCenter(new T.Vector3());
    const sx = ctx.wallL && ctx.wallR ? -0.12 : ctx.wallL ? 0.55 : -0.55;
    sun.position.set(c.x + bounds.r * sx, bounds.r * 1.5 + 1500, c.z + bounds.r * 1.15); sun.target.position.copy(c);
    const sc = sun.shadow.camera, R = bounds.r * 1.25; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 100; sc.far = bounds.r * 5 + 4000; sc.updateProjectionMatrix();
    const key = ctx.fitKey;
    if (refit || key !== lastKey) { lastKey = key; api.fit(ctx.view, !refit); }
    dirty = true;
  };

  api.fit = function (v, animate) {
    if (!bounds) return;
    v = v || (data && data.ctx.view) || { az: 0.5, el: 0.2 };
    const bb = bounds.bb, c = bb.getCenter(new T.Vector3());
    const to = { az: v.az, el: v.el, tx: c.x, ty: c.y, tz: c.z, dist: 0 };
    const ce = Math.cos(to.el), dir = new T.Vector3(Math.sin(to.az) * ce, Math.sin(to.el), Math.cos(to.az) * ce);
    const right = new T.Vector3(Math.cos(to.az), 0, -Math.sin(to.az)), upv = new T.Vector3().crossVectors(dir, right);
    const tv = Math.tan(camera.fov * Math.PI / 360) * 0.9, th = tv * camera.aspect;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const p = new T.Vector3(x - c.x, y - c.y, z - c.z), dz = p.dot(dir);
      to.dist = Math.max(to.dist, dz + Math.abs(p.dot(right)) / th, dz + Math.abs(p.dot(upv)) / tv);
    }
    if (animate) goal = { from: Object.assign({}, cam), to, t0: performance.now() }; else { cam = to; goal = null; }
    dirty = true;
  };
  api.setOpenQuiet = function (v) { open = v; };
  api.setPhoto = function (img) {
    photo = img ? img.src : null; photoImg = img || null;
    host.style.backgroundImage = photo ? "url(" + photo + ")" : "";
    roomG.visible = !photo; catcher.visible = !!photo; dirty = true;
    if (api.ok && !photo) api.fit(null, true);
  };
  api.snapshot = function () {
    if (!api.ok) return null;
    place(); renderer.render(scene, camera);
    const src = renderer.domElement, c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    if (photoImg) { const k = Math.max(c.width / photoImg.naturalWidth, c.height / photoImg.naturalHeight), w = photoImg.naturalWidth * k, h = photoImg.naturalHeight * k; g.drawImage(photoImg, (c.width - w) / 2, (c.height - h) / 2, w, h); }
    else { g.fillStyle = "#eef0ee"; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(src, 0, 0);
    dirty = true;
    return c.toDataURL("image/jpeg", 0.9);
  };
  api.redraw = () => { dirty = true; };
  return api;
})();
