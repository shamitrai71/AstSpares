'use client';

/* =====================================================================
   ASTSPARES CategoryGlobe — data-driven Three.js globe
   ---------------------------------------------------------------------
   - Tiles are built from the `categories` prop, so adding a category
     (in Firestore / your data source) makes a new tile appear with no
     code change. Colour/glyph are derived if a category doesn't supply
     them, so the look stays consistent.
   - Shipping routes are built from `destinations`; `serviceable:true`
     renders bright green, everything else orange.
   - Clicking a tile calls `onCategoryClick(category)` — wire that to
     your router (see CategoryGlobeLoader.jsx).

   Requires: `npm i three`  and  /public/world.jpg
   Works under Next.js static export when imported with { ssr:false }.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const PALETTE = ['#D65210','#2A7F8E','#6B8F3A','#B23A48','#C7A06A','#5B8AC0','#C9A227','#7A6A55','#3E5C76','#9A5B8E'];

// derive a glyph from the category name when one isn't supplied
function guessGlyph(name = '') {
  const n = name.toLowerCase();
  if (n.includes('seal')) return 'seal';
  if (n.includes('suction')) return 'tube';
  if (n.includes('vent')) return 'vent';
  if (n.includes('flame') || n.includes('arrest')) return 'grid';
  if (n.includes('gasket')) return 'ring';
  if (n.includes('gauge') || n.includes('level')) return 'gauge';
  if (n.includes('lightning') || n.includes('surge')) return 'bolt';
  return 'box';
}

export default function CategoryGlobe({
  categories = [],
  destinations = [],
  mapSrc = '/world.jpg',
  hub = { name: 'Mumbai', lat: 19.07, lon: 72.87 },
  onCategoryClick,
}) {
  const mountRef = useRef(null);
  const tipRef = useRef(null);
  const cbRef = useRef(onCategoryClick);
  cbRef.current = onCategoryClick;
  const [legendOpen, setLegendOpen] = useState(false);

  // normalise categories once per change
  const cats = categories.map((c, i) => ({
    raw: c,
    name: c.name || c.title || c.label || c.id || `Category ${i + 1}`,
    code: (c.code || c.codePrefix || '').toString().toUpperCase(),
    color: c.color || PALETTE[i % PALETTE.length],
    glyph: c.glyph || guessGlyph(c.name || c.title || ''),
    std: c.std || c.standard || c.standards || '',
  }));
  const dests = destinations.map((d) => ({
    name: d.name || d.city || d.id,
    lat: Number(d.lat ?? d.latitude),
    lon: Number(d.lon ?? d.lng ?? d.longitude),
    serviceable: !!(d.serviceable ?? d.active ?? d.live),
  })).filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon));

  // rebuild the scene whenever the data (or map/hub) changes
  const sig = JSON.stringify({
    c: cats.map((c) => [c.name, c.color, c.glyph, c.std]),
    d: dests.map((d) => [d.name, d.lat, d.lon, d.serviceable]),
    mapSrc, hub,
  });

  useEffect(() => {
    const mount = mountRef.current;
    const tip = tipRef.current;
    if (!mount) return;
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------- helpers ----------
    function shade(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
      r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
      return `rgb(${r},${g},${b})`;
    }
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r);
        this.closePath(); return this;
      };
    }
    function drawGlyph(ctx, glyph, cx, cy, r) {
      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(255,255,255,.96)'; ctx.fillStyle = 'rgba(255,255,255,.96)';
      ctx.lineWidth = r * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      switch (glyph) {
        case 'ring': ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.moveTo(r * .5, 0); ctx.arc(0, 0, r * .5, 0, 7); ctx.stroke(); break;
        case 'seal': ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
          for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(Math.cos(a / 8 * 6.28) * r * .55, Math.sin(a / 8 * 6.28) * r * .55); ctx.lineTo(Math.cos(a / 8 * 6.28) * r, Math.sin(a / 8 * 6.28) * r); ctx.stroke(); } break;
        case 'tube': ctx.beginPath(); ctx.roundRect(-r * .55, -r, r * 1.1, r * 2, r * .3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke(); break;
        case 'vent': ctx.beginPath(); ctx.moveTo(-r, r); ctx.lineTo(0, -r); ctx.lineTo(r, r); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -r * .2, r * .3, 0, 7); ctx.stroke(); break;
        case 'grid': for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * .6, -r); ctx.lineTo(i * r * .6, r); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r, i * r * .6); ctx.lineTo(r, i * r * .6); ctx.stroke(); } break;
        case 'gauge': ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * .8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * .6, -r * .4); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .12, 0, 7); ctx.fill(); break;
        case 'bolt': ctx.beginPath(); ctx.moveTo(r * .3, -r); ctx.lineTo(-r * .3, r * .1); ctx.lineTo(r * .05, r * .1); ctx.lineTo(-r * .3, r); ctx.lineTo(r * .35, -r * .1); ctx.lineTo(0, -r * .1); ctx.closePath(); ctx.fill(); break;
        default: ctx.beginPath(); ctx.roundRect(-r * .8, -r * .6, r * 1.6, r * 1.2, r * .15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * .8, -r * .15); ctx.lineTo(r * .8, -r * .15); ctx.stroke(); // box
      }
      ctx.restore();
    }
    function wrapText(ctx, text, cx, y, maxW, lh) {
      const words = text.split(' '); let line = '', lines = [];
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line);
      const startY = y - (lines.length - 1) * lh / 2;
      lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lh));
    }
    function tileTexture(c) {
      const W = 320, H = 160, pad = 8, r = 16;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
      // Dark panel matching the Mumbai marker, with a thin family-colour keyline.
      x.fillStyle = 'rgba(8,42,49,.94)';
      x.beginPath(); x.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r); x.fill();
      x.lineWidth = 3; x.strokeStyle = c.color || '#E8742F';
      x.beginPath(); x.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r); x.stroke();
      x.textAlign = 'center';
      // Category name (uppercase, wraps to fit).
      x.fillStyle = '#F4EEE3'; x.font = `700 27px ui-sans-serif,system-ui,sans-serif`;
      wrapText(x, c.name.toUpperCase(), W / 2, H * 0.40, W - 36, 31);
      // Part-number prefix, e.g. AST-RS.
      if (c.code) {
        x.fillStyle = c.color || '#E8742F';
        x.font = `800 30px ui-monospace,SFMono-Regular,Menlo,monospace`;
        x.fillText('AST-' + c.code, W / 2, H - 26);
      }
      const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
    }
    function dotTex(ring) {
      const s = 48, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
      x.beginPath(); x.arc(s / 2, s / 2, s * 0.30, 0, 7); x.fillStyle = '#F4EEE3'; x.fill();
      x.lineWidth = s * 0.10; x.strokeStyle = ring; x.beginPath(); x.arc(s / 2, s / 2, s * 0.30, 0, 7); x.stroke();
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    const llToVec = (lat, lon, r) => {
      const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    };
    function arcPoints(a, b, r, segs) {
      const va = a.clone().normalize(), vb = b.clone().normalize();
      const dot = Math.max(-1, Math.min(1, va.dot(vb))), om = Math.acos(dot), pts = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs; let v;
        if (om < 1e-4) v = va.clone();
        else { const s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om); v = va.clone().multiplyScalar(s1).add(vb.clone().multiplyScalar(s2)); }
        pts.push(v.normalize().multiplyScalar(r + Math.sin(t * Math.PI) * (r * 0.16)));
      }
      return pts;
    }

    // ---------- scene ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x082A31, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x082A31, 22, 42);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    const CAM_Z = 22; camera.position.set(0, 0, CAM_Z);

    const RADIUS = 9, PLANET_R = RADIUS - 0.6, TILE_R = RADIUS + 0.4;
    const group = new THREE.Group(); group.rotation.y = -1.1; scene.add(group);

    scene.add(new THREE.AmbientLight(0x6a7c86, 0.8));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.15); sun.position.set(7, 4, 9); scene.add(sun);

    // Recolour the two-tone world map at runtime: ocean -> bright deep blue,
    // land -> brighter golden yellow. Tweak OCEAN_COLOR / LAND_COLOR to taste.
    const OCEAN_COLOR = [0x0b, 0x5f, 0xd9];   // #0B5FD9 bright, deep blue
    const LAND_COLOR  = [0xe3, 0xb0, 0x28];   // #E3B028 brighter golden yellow
    const planetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R, 96, 96), planetMat);
    (() => {
      const img = new Image();
      img.onload = () => {
        const cw = img.naturalWidth, ch = img.naturalHeight;
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const id = cx.getImageData(0, 0, cw, ch), p = id.data;
        for (let i = 0; i < p.length; i += 4) {
          // ocean pixels are blue-dominant (b>g); land is green/olive (g>b)
          const c = p[i + 2] > p[i + 1] ? OCEAN_COLOR : LAND_COLOR;
          p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2];
        }
        cx.putImageData(id, 0, 0);
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        try { tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (e) { /* noop */ }
        planetMat.map = tex; planetMat.needsUpdate = true;
      };
      img.src = mapSrc;
    })();
    group.add(planet);

    // hub brand marker
    const HUB = llToVec(hub.lat, hub.lon, PLANET_R);
    (function () {
      const cv = document.createElement('canvas'); cv.width = 360; cv.height = 128; const x = cv.getContext('2d');
      x.fillStyle = 'rgba(8,42,49,.92)'; x.roundRect(86, 16, 260, 56, 12); x.fill();
      x.strokeStyle = 'rgba(244,238,227,.32)'; x.lineWidth = 2; x.roundRect(86, 16, 260, 56, 12); x.stroke();
      x.fillStyle = '#F4EEE3'; x.textAlign = 'left'; x.font = '700 30px ui-sans-serif,system-ui,sans-serif';
      x.fillText('AST', 104, 54); x.fillStyle = '#E8742F'; x.fillText('SPARES', 158, 54);
      x.strokeStyle = '#F4EEE3'; x.lineWidth = 3; x.beginPath(); x.moveTo(86, 60); x.lineTo(52, 104); x.stroke();
      x.fillStyle = '#D65210'; x.beginPath(); x.arc(52, 104, 13, 0, 7); x.fill();
      x.lineWidth = 4; x.strokeStyle = '#F4EEE3'; x.beginPath(); x.arc(52, 104, 13, 0, 7); x.stroke();
      const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sprite.position.copy(llToVec(hub.lat, hub.lon, PLANET_R + 0.05));
      sprite.center.set(0.145, 0.19); sprite.scale.set(3.0, 3.0 * 128 / 360, 1);
      group.add(sprite);
    })();

    // destination markers + routes
    const DOT_O = dotTex('#D65210'), DOT_G = dotTex('#2FC75A'), C_GREEN = 0x2FC75A, C_ORANGE = 0xD65210;
    const cityMarkers = [];
    dests.forEach((d) => {
      const green = d.serviceable;
      const pos = llToVec(d.lat, d.lon, PLANET_R);
      const geo = new THREE.BufferGeometry().setFromPoints(arcPoints(HUB, pos, PLANET_R + 0.04, 64));
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: green ? C_GREEN : C_ORANGE, transparent: true, opacity: green ? 0.85 : 0.38, fog: false })));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: green ? DOT_G : DOT_O, transparent: true, depthWrite: false }));
      sp.position.copy(llToVec(d.lat, d.lon, PLANET_R + 0.04)); sp.scale.set(green ? 0.5 : 0.44, green ? 0.5 : 0.44, 1); sp.userData = { name: d.name };
      group.add(sp); cityMarkers.push(sp);
    });

    // starfield + halo
    const starGeo = new THREE.BufferGeometry(); const starN = 1400, sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) { const r = 55 + Math.random() * 55, u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u); sp[i * 3] = r * s * Math.cos(a); sp[i * 3 + 1] = r * u; sp[i * 3 + 2] = r * s * Math.sin(a); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xF4EEE3, size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    scene.add(stars);
    const gcv = document.createElement('canvas'); gcv.width = gcv.height = 256; const gx = gcv.getContext('2d');
    const gg = gx.createRadialGradient(128, 128, 52, 128, 128, 128); gg.addColorStop(0, 'rgba(150,194,219,.42)'); gg.addColorStop(.5, 'rgba(120,170,200,.13)'); gg.addColorStop(1, 'rgba(120,170,200,0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 256, 256);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gcv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.set(PLANET_R * 2.9, PLANET_R * 2.9, 1); scene.add(glow);

    // category tiles
    const tiles = [];
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    cats.forEach((c, i) => {
      const phi = Math.acos(1 - 2 * (i + 0.5) / Math.max(cats.length, 1));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const x = TILE_R * Math.sin(phi) * Math.cos(theta), y = TILE_R * Math.cos(phi), z = TILE_R * Math.sin(phi) * Math.sin(theta);
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: tileTexture(c), transparent: true }));
      tile.position.set(x, y, z); tile.lookAt(x * 2, y * 2, z * 2); tile.userData = { cat: c.raw };
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.54, 1.34), new THREE.MeshBasicMaterial({ color: 0xD65210 }));
      frame.position.z = -0.06; frame.visible = false; frame.raycast = () => {}; tile.add(frame); tile.userData.frame = frame;
      group.add(tile); tiles.push(tile);
    });

    // ---------- interaction ----------
    let autoSpeed = REDUCED ? 0 : 0.0014, curSpeed = autoSpeed, focused = null, hovered = null;
    let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0, velX = 0, velY = 0;
    const dom = renderer.domElement;
    const setPointer = (e) => { const r = dom.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1; };
    const nearSide = (o) => { const w = new THREE.Vector3(); o.getWorldPosition(w); return w.normalize().dot(camera.position.clone().normalize()) > 0.05; };
    function frontTile() {
      raycaster.setFromCamera(pointer, camera);
      const tHit = raycaster.intersectObjects(tiles, false)[0]; if (!tHit) return null;
      const pHit = raycaster.intersectObject(planet, false)[0];
      if (pHit && pHit.distance < tHit.distance - 0.05) return null;
      return tHit.object;
    }
    const cityHit = () => { raycaster.setFromCamera(pointer, camera); const h = raycaster.intersectObjects(cityMarkers, false).filter((x) => nearSide(x.object)); return h.length ? h[0].object : null; };
    const setFrame = (t, on) => { t.userData.frame.visible = on; t.scale.setScalar(on ? 1.12 : 1); };
    const showTip = (txt, x, y) => { if (!tip) return; tip.textContent = txt; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = '1'; };
    const hideTip = () => { if (tip) tip.style.opacity = '0'; };

    const onDown = (e) => { dragging = true; moved = false; dom.setPointerCapture(e.pointerId); lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now(); };
    const onMove = (e) => {
      if (dragging && !focused) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) moved = true;
        group.rotation.y += dx * 0.005; group.rotation.x = Math.max(-1.1, Math.min(1.1, group.rotation.x + dy * 0.005));
        velX = dx * 0.005; velY = dy * 0.005; lastX = e.clientX; lastY = e.clientY; hideTip();
      } else if (e.pointerType === 'mouse' && !focused) {
        setPointer(e); const t = frontTile();
        if (t !== hovered) { if (hovered) setFrame(hovered, false); hovered = t; if (hovered) setFrame(hovered, true); dom.style.cursor = hovered ? 'pointer' : 'grab'; }
        const cm = cityHit(); if (cm) showTip(cm.userData.name, e.clientX, e.clientY); else hideTip();
      }
    };
    let tipT;
    const onUp = (e) => {
      dragging = false;
      if (!moved && performance.now() - downT < 500 && !focused) {
        setPointer(e); const t = frontTile();
        if (t) { setFrame(t, true); cbRef.current && cbRef.current(t.userData.cat); }
        else { const cm = cityHit(); if (cm) { showTip(cm.userData.name, e.clientX, e.clientY); clearTimeout(tipT); tipT = setTimeout(hideTip, 1600); } }
      }
    };
    const onLeave = () => { if (hovered) { setFrame(hovered, false); hovered = null; } };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointerleave', onLeave);

    // Fit the whole tile orbit within the viewport on any aspect ratio by
    // pushing the camera back as needed — keeps the globe inside the borders
    // on desktop and stops it overflowing on narrow / mobile screens.
    const FIT_R = TILE_R + 1.6;
    function resize() {
      const w = mount.clientWidth || innerWidth, h = mount.clientHeight || innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const tanV = Math.tan((camera.fov * Math.PI / 180) / 2);
      const tanH = tanV * camera.aspect;
      // Globe size by device. Larger factor = camera further = smaller globe.
      // Mobile keeps the bigger size (0.88); desktop is a little smaller (1.06).
      const margin = w >= 768 ? 1.06 : 0.88;
      let dist = Math.max(FIT_R / tanV, FIT_R / tanH) * margin;
      dist = Math.max(dist, 16);
      // Bias the globe toward the bottom using part of the spare vertical room
      // (never enough to clip the lowest tile); camera up = globe down.
      const headroom = Math.max(0, dist * tanV - FIT_R);
      const yOffset = Math.min(headroom * 0.5, FIT_R * 0.12);
      camera.position.set(0, yOffset, dist);
      camera.updateProjectionMatrix();
      if (scene.fog) { scene.fog.near = dist; scene.fog.far = dist + 20; }
    }
    addEventListener('resize', resize); resize();

    const clock = new THREE.Clock(); let raf;
    function tick() {
      raf = requestAnimationFrame(tick); const dt = Math.min(clock.getDelta(), 0.05);
      stars.rotation.y += dt * 0.004;
      if (!dragging && !focused) { velX *= 0.94; velY *= 0.94; group.rotation.y += velX + curSpeed; group.rotation.x += velY; group.rotation.x *= 0.985; }
      renderer.render(scene, camera);
    }
    tick();

    // ---------- cleanup ----------
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.map?.dispose?.(); mm.dispose?.(); }); } });
      renderer.dispose();
      if (dom.parentNode === mount) mount.removeChild(dom);
    };
  }, [sig]);

  // sorted destination list for the legend
  const legendList = [...dests].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div ref={mountRef} style={{ position: 'absolute', inset: 0, background: '#082A31', overflow: 'hidden' }}>
      <div ref={tipRef} style={{ position: 'fixed', zIndex: 25, pointerEvents: 'none', background: 'rgba(8,42,49,.92)', border: '1px solid rgba(244,238,227,.16)', color: '#F4EEE3', font: '12px ui-sans-serif,system-ui', padding: '5px 9px', borderRadius: 7, transform: 'translate(-50%,-160%)', opacity: 0, transition: 'opacity .12s', whiteSpace: 'nowrap' }} />
      {legendList.length > 0 && (
        <aside style={{ position: 'absolute', zIndex: 18, left: 16, bottom: 16, width: 240, maxWidth: '46vw', background: 'rgba(8,42,49,.82)', border: '1px solid rgba(244,238,227,.16)', borderRadius: 12, backdropFilter: 'blur(6px)', overflow: 'hidden', color: '#F4EEE3', fontFamily: 'ui-sans-serif,system-ui' }}>
          <h4 onClick={() => setLegendOpen((o) => !o)} style={{ margin: 0, padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, font: '600 11px ui-sans-serif,system-ui', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,238,227,.62)' }}>
            From {hub.name} · <b style={{ color: '#E8742F' }}>{dests.length}</b> destinations
            <span style={{ marginLeft: 'auto', opacity: .6 }}>{legendOpen ? '▴' : '▾'}</span>
          </h4>
          {legendOpen && (
            <div style={{ padding: '0 14px 12px', columns: 2, columnGap: 14, fontSize: 11.5, color: 'rgba(244,238,227,.82)', maxHeight: '34vh', overflow: 'auto' }}>
              {legendList.map((d) => (
                <div key={d.name} style={{ breakInside: 'avoid', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i style={{ width: 6, height: 6, borderRadius: '50%', background: d.serviceable ? '#2FC75A' : '#D65210', flex: '0 0 auto' }} />{d.name}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
