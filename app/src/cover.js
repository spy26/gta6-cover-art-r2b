// Vice Cover Studio — cover renderer (fresh implementation).
// Draws a GTA-style multi-panel poster onto any 2D canvas context at any size.
// No external assets: system fonts only, all decoration drawn in code.
'use strict';

export const LAYOUTS = ['diagonal', 'hero', 'triptych', 'magazine', 'duo'];
export const PRESETS = ['sunset', 'neon', 'golden', 'midnight', 'postcard'];
export const EXPORT_SIZES = [
  { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
  { label: 'Story 1080 × 1920', w: 1080, h: 1920 },
];

// Focal points keep faces in frame when a panel crops the photo.
export const FOCUS = {
  boulevard: { x: 0.60, y: 0.30 },
  pier: { x: 0.30, y: 0.28 },
};

const PRESET_DEFS = {
  sunset: {
    band: ['#3a0d5e', '#1c0533'], bandSolid: '#2a0a4a',
    title: '#ffffff', outline: '#1c0533', glow: '#ff2ea6',
    pillBg: '#ff8a1e', pillFg: '#2a0a12', sub: '#f5c86b', foot: '#e8c9ff',
    accent: '#ffb52e', halftone: '#ffb52e', gradeTop: 'rgba(255,110,40,0.10)',
    gradeBot: 'rgba(255,0,140,0.12)', sunA: '#ffb52e', sunB: '#ff2e7e',
    sky: '#1c0533', palm: '#16032b', badge: '#ff2ea6',
  },
  neon: {
    band: ['#12082e', '#05010f'], bandSolid: '#0d0620',
    title: '#ffffff', outline: '#0a0220', glow: '#19e3ff',
    pillBg: '#19e3ff', pillFg: '#04222b', sub: '#7df3ff', foot: '#bfefff',
    accent: '#ff2ea6', halftone: '#19e3ff', gradeTop: 'rgba(0,220,255,0.08)',
    gradeBot: 'rgba(255,0,180,0.14)', sunA: '#ff5e3a', sunB: '#ff2ea6',
    sky: '#05010f', palm: '#03010a', badge: '#ff2ea6',
  },
  golden: {
    band: ['#0e3a2c', '#062117'], bandSolid: '#0b2e25',
    title: '#fff6d8', outline: '#062117', glow: '#ffb52e',
    pillBg: '#ffd34d', pillFg: '#2b1c00', sub: '#ffe9a8', foot: '#d8f0d8',
    accent: '#ffd34d', halftone: '#ffd34d', gradeTop: 'rgba(255,180,60,0.12)',
    gradeBot: 'rgba(255,120,0,0.10)', sunA: '#ffe066', sunB: '#ff7a1e',
    sky: '#062117', palm: '#04160f', badge: '#ffb52e',
  },
  midnight: {
    band: ['#101a4a', '#070b26'], bandSolid: '#0a1030',
    title: '#ffffff', outline: '#070b26', glow: '#4d7cff',
    pillBg: '#7fa8ff', pillFg: '#0a1030', sub: '#a9c2ff', foot: '#cdd8ff',
    accent: '#4d7cff', halftone: '#7fa8ff', gradeTop: 'rgba(60,110,255,0.10)',
    gradeBot: 'rgba(120,60,255,0.12)', sunA: '#8fb0ff', sunB: '#b04dff',
    sky: '#070b26', palm: '#04061a', badge: '#4d7cff',
  },
  postcard: {
    band: ['#f7ead2', '#efd9ae'], bandSolid: '#f3e3c2',
    title: '#3d0a4d', outline: '#fff6e0', glow: '#ff5e7a',
    pillBg: '#ff5e6e', pillFg: '#ffffff', sub: '#7a3a10', foot: '#6b4a1e',
    accent: '#ff5e6e', halftone: '#c98a2e', gradeTop: 'rgba(255,200,120,0.10)',
    gradeBot: 'rgba(255,120,90,0.08)', sunA: '#ffb52e', sunB: '#ff5e6e',
    sky: '#3d0a4d', palm: '#3d0a4d', badge: '#ff2e7e',
  },
};

export function presetDef(name) { return PRESET_DEFS[name] || PRESET_DEFS.sunset; }

export function defaultState() {
  return {
    layout: 'diagonal',
    preset: 'sunset',
    title: 'SUNSET HEIST',
    pill: 'ONE LAST SCORE',
    subtitle: 'VICE CITY \u2022 EST. 2026',
    footer: 'LEONIDA',
    titleScale: 1,
    // one crop per panel slot; photo names are 'boulevard' | 'pier' | 'custom0..2'
    panels: [
      { photo: 'boulevard', zoom: 1.0, x: 0, y: 0, flip: false },
      { photo: 'pier', zoom: 1.0, x: 0, y: 0, flip: false },
      { photo: 'boulevard', zoom: 1.15, x: 0.06, y: 0, flip: false },
    ],
    fx: { grain: true, halftone: true, palms: true, sun: true, skyline: true, vignette: true, grade: true },
  };
}

// Per-layout default photo assignment (slot order matches geometry order).
export const LAYOUT_PHOTOS = {
  diagonal: ['boulevard', 'pier', 'boulevard'],
  hero: ['boulevard', 'pier', 'boulevard'],
  triptych: ['boulevard', 'pier', 'boulevard'],
  magazine: ['boulevard', 'boulevard', 'boulevard'],
  duo: ['boulevard', 'pier', 'boulevard'],
};

export function applyLayoutDefaults(state) {
  const photos = LAYOUT_PHOTOS[state.layout] || LAYOUT_PHOTOS.diagonal;
  state.panels = photos.map((p, i) => {
    const prev = state.panels[i] || {};
    return { photo: p, zoom: prev.photo === p ? (prev.zoom || 1) : 1, x: 0, y: 0, flip: false };
  });
  // Bottom-right diagonal panel gets a tighter crop so it is not a clone of the hero.
  if (state.layout === 'diagonal') state.panels[2].zoom = 1.15;
  if (state.layout === 'triptych') state.panels[2].zoom = 1.1;
}

// ---- deterministic pseudo-random (stable screenshots) ----
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- photo drawing: cover-fit into a rect or polygon, focal-point crop ----
function drawPhotoInto(ctx, img, path, crop, W, H) {
  if (!img) return;
  ctx.save();
  ctx.beginPath();
  if (path.poly) {
    ctx.moveTo(path.poly[0][0], path.poly[0][1]);
    for (let i = 1; i < path.poly.length; i++) ctx.lineTo(path.poly[i][0], path.poly[i][1]);
    ctx.closePath();
  } else {
    ctx.rect(path.x, path.y, path.w, path.h);
  }
  ctx.clip();
  const r = path.poly ? polyBounds(path.poly) : path;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const scale = Math.max(r.w / iw, r.h / ih) * (crop.zoom || 1);
  const dw = iw * scale, dh = ih * scale;
  const focus = FOCUS[crop.photo] || { x: 0.5, y: 0.5 };
  // Anchor the focal point, then apply the user's pan offset.
  let dx = r.x + r.w * 0.5 - dw * focus.x + (crop.x || 0) * r.w * 0.2;
  let dy = r.y + r.h * 0.5 - dh * focus.y + (crop.y || 0) * r.h * 0.2;
  dx = Math.min(r.x, Math.max(r.x + r.w - dw, dx));
  dy = Math.min(r.y, Math.max(r.y + r.h - dh, dy));
  if (crop.flip) {
    ctx.translate(r.x + r.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(r.x + r.w / 2), 0);
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function polyBounds(poly) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---- decoration pieces ----
function drawSun(ctx, cx, cy, r, def, withMark) {
  ctx.save();
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, def.sunA); g.addColorStop(1, def.sunB);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  // Retro slits across the lower half: thin gaps, classic synthwave sun.
  const slits = [[0.12, 0.05], [0.32, 0.06], [0.52, 0.07], [0.72, 0.08]];
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  for (const [fy, fh] of slits) {
    ctx.fillStyle = def.bandSolid;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(cx - r, cy + r * fy, r * 2, r * fh);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (withMark) {
    ctx.fillStyle = '#1c0533';
    ctx.font = `900 ${r * 0.62}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VI', cx, cy - r * 0.18);
  }
  ctx.restore();
}

function drawSkyline(ctx, x, yBase, w, h, def, seed) {
  const rand = rng(seed);
  ctx.save();
  ctx.fillStyle = def.sky;
  let cx = x;
  while (cx < x + w) {
    const bw = w * (0.03 + rand() * 0.05);
    const bh = h * (0.25 + rand() * 0.75);
    ctx.fillRect(cx, yBase - bh, bw, bh);
    // A few lit windows.
    if (rand() > 0.6) {
      ctx.fillStyle = def.accent;
      ctx.fillRect(cx + bw * 0.3, yBase - bh * 0.7, Math.max(2, bw * 0.12), Math.max(2, bh * 0.08));
      ctx.fillStyle = def.sky;
    }
    cx += bw + w * 0.008;
  }
  ctx.restore();
}

function drawPalm(ctx, x, yBase, s, def, flip) {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.scale(flip ? -s : s, -s); // draw upward from the base
  ctx.strokeStyle = def.palm; ctx.fillStyle = def.palm;
  ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -52, 16, -92); ctx.stroke();
  // Fronds fanning from the crown.
  ctx.lineWidth = 5;
  const fronds = [[-58, -18], [-44, -46], [-16, -62], [14, -58], [42, -40], [56, -12], [30, 2]];
  for (const [fx, fy] of fronds) {
    ctx.beginPath(); ctx.moveTo(16, -92);
    ctx.quadraticCurveTo(16 + fx * 0.6, -92 + fy * 0.7, 16 + fx, -92 + fy);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(16, -92, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHalftone(ctx, x, y, cols, rows, gap, def, maxR) {
  ctx.save();
  ctx.fillStyle = def.halftone;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rr = maxR * (1 - (r / rows) * 0.55) * (1 - (c / cols) * 0.25);
      ctx.beginPath();
      ctx.arc(x + c * gap, y + r * gap, Math.max(0.6, rr), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Auto-fit title: shrink until it fits the available width, then draw with
// outline + glow. Returns the font size used.
function drawTitle(ctx, text, x, y, maxW, baseSize, def, scale, align) {
  let size = baseSize * (scale || 1);
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `900 ${s}px "Arial Black", Arial, sans-serif`; };
  setFont(size);
  try { ctx.letterSpacing = `${Math.max(0, size * 0.012)}px`; } catch { /* older canvas */ }
  let w = ctx.measureText(text).width;
  while (w > maxW && size > 24) { size *= 0.94; setFont(size); w = ctx.measureText(text).width; }
  ctx.save();
  ctx.shadowColor = def.glow; ctx.shadowBlur = size * 0.28;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.075);
  ctx.strokeStyle = def.outline;
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = def.title;
  ctx.fillText(text, x, y);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  return size;
}

// Pill sized from its measured text — it can never clip its own label.
function drawPill(ctx, text, x, y, def, h) {
  ctx.save();
  ctx.font = `800 ${h * 0.52}px Arial, sans-serif`;
  try { ctx.letterSpacing = `${h * 0.06}px`; } catch { /* ignore */ }
  const tw = ctx.measureText(text).width;
  const pad = h * 0.75;
  const w = tw + pad * 2;
  ctx.fillStyle = def.pillBg;
  ctx.shadowColor = def.pillBg; ctx.shadowBlur = h * 0.5;
  roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = def.pillFg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + h * 0.02);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  return w;
}

function drawFooter(ctx, W, y, def, footerText, bandW) {
  ctx.save();
  ctx.font = `700 ${Math.max(14, W * 0.018)}px Arial, sans-serif`;
  ctx.fillStyle = def.accent;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('\u2605  \u2605  \u2605  \u2605  \u2605', W * 0.045, y);
  ctx.fillStyle = def.foot;
  ctx.textAlign = 'right';
  try { ctx.letterSpacing = `${W * 0.004}px`; } catch { /* ignore */ }
  ctx.fillText(footerText, W - W * 0.045, y);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

// ---- geometry per layout ----
// Returns { panels: [{path, slot}], photoH, bandTop, bandH, sun: {x,y,r,slot}|null, stripSlant }
function geometry(layout, W, H) {
  const sq = H / W; // aspect helper; square ~1, wide <1, tall >1
  if (layout === 'diagonal') {
    const photoH = H * 0.60;
    const slant = W * 0.055;
    return {
      panels: [
        { path: { poly: [[0, 0], [W * 0.60, 0], [W * 0.60 + slant, photoH], [0, photoH]] }, slot: 0 },
        { path: { poly: [[W * 0.60 + 6, 0], [W, 0], [W, photoH * 0.50], [W * 0.60 + slant * 0.5 + 6, photoH * 0.50]] }, slot: 1 },
        { path: { poly: [[W * 0.60 + slant * 0.5 + 6, photoH * 0.50 + 6], [W, photoH * 0.50 + 6], [W, photoH], [W * 0.60 + slant + 6, photoH]] }, slot: 2 },
      ],
      photoH, bandTop: photoH, bandH: H - photoH,
      sun: { x: W * 0.895, y: photoH * 0.17, r: W * 0.068 },
      strip: true, slant,
    };
  }
  if (layout === 'hero') {
    const topH = H * 0.52, botH = H * 0.20;
    return {
      panels: [
        { path: { x: 0, y: 0, w: W, h: topH }, slot: 0 },
        { path: { x: 0, y: topH + 6, w: W * 0.5 - 3, h: botH }, slot: 1 },
        { path: { x: W * 0.5 + 3, y: topH + 6, w: W * 0.5 - 3, h: botH }, slot: 2 },
      ],
      photoH: topH + botH + 6, bandTop: topH + botH + 6, bandH: H - topH - botH - 6,
      sun: { x: W * 0.90, y: topH * 0.18, r: W * 0.068 },
      strip: false,
    };
  }
  if (layout === 'triptych') {
    const photoH = H * 0.62;
    const pw = W / 3;
    return {
      panels: [0, 1, 2].map(i => ({ path: { x: i * pw + (i ? 3 : 0), y: 0, w: pw - (i ? 3 : 0) - (i < 2 ? 3 : 0), h: photoH }, slot: i })),
      photoH, bandTop: photoH, bandH: H - photoH,
      sun: null, strip: false,
    };
  }
  if (layout === 'duo') {
    const photoH = H * 0.62;
    return {
      panels: [
        { path: { x: 0, y: 0, w: W * 0.5 - 3, h: photoH }, slot: 0 },
        { path: { x: W * 0.5 + 3, y: 0, w: W * 0.5 - 3, h: photoH }, slot: 1 },
        { path: { x: 0, y: 0, w: 0, h: 0 }, slot: 2 }, // unused slot
      ],
      photoH, bandTop: photoH, bandH: H - photoH,
      sun: { x: W * 0.90, y: photoH * 0.17, r: W * 0.07 },
      strip: false,
    };
  }
  // magazine: single full-bleed photo; panels list is only the one photo.
  return {
    panels: [{ path: { x: 0, y: 0, w: W, h: H }, slot: 0 }],
    photoH: H, bandTop: H, bandH: 0,
    sun: null, strip: false, magazine: true,
  };
}

// ---- main draw ----
export function drawCover(ctx, W, H, state, images) {
  const def = presetDef(state.preset);
  const fx = state.fx || {};
  const compare = !!state.compare; // hold-to-compare: clean render, no grade/fx
  const geo = geometry(state.layout, W, H);
  ctx.clearRect(0, 0, W, H);

  // Band background first (under everything) so panels sit on it cleanly.
  const bandGrad = ctx.createLinearGradient(0, geo.bandTop, 0, H);
  bandGrad.addColorStop(0, def.band[0]); bandGrad.addColorStop(1, def.band[1]);
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, 0, W, H);

  // Photos.
  for (const p of geo.panels) {
    const crop = state.panels[p.slot] || { photo: 'boulevard', zoom: 1, x: 0, y: 0 };
    if (p.path.w === 0 && !p.path.poly) continue;
    const img = images[crop.photo];
    if (img) drawPhotoInto(ctx, img, p.path, crop, W, H);
    else { ctx.fillStyle = '#333'; ctx.fillRect(p.path.x || 0, p.path.y || 0, p.path.w || 0, p.path.h || 0); }
  }

  // Warm/cool grade over the photos only.
  if (fx.grade && !compare) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(0, 0, 0, geo.photoH);
    g.addColorStop(0, def.gradeTop); g.addColorStop(1, def.gradeBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, geo.photoH);
    ctx.restore();
  }

  // Retro sun with the VI mark (never an empty badge).
  if (fx.sun && !compare && geo.sun) drawSun(ctx, geo.sun.x, geo.sun.y, geo.sun.r, def, true);

  // Skyline + palms live inside the photo zone, clipped there — never cut by the title band.
  if (!geo.magazine) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, geo.photoH); ctx.clip();
    if (fx.skyline && !compare) {
      const stripH = Math.min(H * 0.075, geo.photoH * 0.16);
      drawSkyline(ctx, 0, geo.photoH, W, stripH, def, 7);
    }
    if (fx.palms && !compare) {
      const s = Math.min(W, H) * 0.0016;
      drawPalm(ctx, W * 0.02, geo.photoH + 2, s, def, false);
      drawPalm(ctx, W * 0.98, geo.photoH + 2, s * 0.9, def, true);
    }
    ctx.restore();
  }

  if (geo.magazine) { drawMagazine(ctx, W, H, state, def, fx, compare); }
  else { drawTitleBand(ctx, W, H, state, def, geo, fx, compare); }

  // Vignette + grain over the whole cover.
  if (!compare) {
    if (fx.vignette) {
      ctx.save();
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (fx.grain) {
      const rand = rng(1234);
      ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
      for (let i = 0; i < W * H / 900; i++) ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
      ctx.restore();
    }
  }

  // Diagonal accent stripe along the hero slant.
  if (geo.strip && state.layout === 'diagonal') {
    ctx.save();
    ctx.strokeStyle = def.accent; ctx.lineWidth = Math.max(3, W * 0.006);
    ctx.beginPath();
    ctx.moveTo(W * 0.60 + 2, 0); ctx.lineTo(W * 0.60 + geo.slant + 2, geo.photoH);
    ctx.stroke();
    ctx.restore();
  }
  // Outer frame.
  ctx.save();
  ctx.strokeStyle = def.outline; ctx.lineWidth = Math.max(3, W * 0.005);
  ctx.strokeRect(0, 0, W, H);
  ctx.restore();
}

function drawTitleBand(ctx, W, H, state, def, geo, fx, compare) {
  const bandTop = geo.bandTop, bandH = geo.bandH;
  const padX = W * 0.045;
  // Diagonal strip: slanted purple ribbon with skyline + halftone above the band.
  let titleY0 = bandTop;
  if (geo.strip) {
    const stripH = H * 0.085;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, bandTop + stripH * 0.45);
    ctx.lineTo(W, bandTop - stripH * 0.25);
    ctx.lineTo(W, bandTop + stripH * 0.55);
    ctx.lineTo(0, bandTop + stripH * 1.25);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, bandTop, W, bandTop);
    g.addColorStop(0, def.band[0]); g.addColorStop(1, def.band[1]);
    ctx.fillStyle = g; ctx.fillRect(0, bandTop - stripH, W, stripH * 2.5);
    if (fx.skyline && !compare) drawSkyline(ctx, 0, bandTop + stripH * 1.02, W, stripH * 0.55, def, 21);
    ctx.restore();
    if (fx.halftone && !compare) drawHalftone(ctx, W * 0.86, bandTop + stripH * 0.1, 6, 3, W * 0.018, def, W * 0.004);
    titleY0 = bandTop + stripH * 0.9;
  } else if (fx.halftone && !compare) {
    drawHalftone(ctx, W * 0.86, bandTop + bandH * 0.10, 6, 3, W * 0.018, def, W * 0.004);
  }

  const availH = H - titleY0;
  const pillH = Math.min(availH * 0.17, H * 0.048);
  const pillY = titleY0 + availH * 0.06;
  drawPill(ctx, state.pill || '', padX, pillY, def, pillH);

  // Title: one line, auto-fit, pink glow. Sits clear of the halftone zone.
  const titleBase = Math.min(availH * 0.40, W * 0.16);
  const titleY = pillY + pillH + titleBase * 0.95;
  drawTitle(ctx, (state.title || '').toUpperCase(), W / 2, titleY, W - padX * 2, titleBase, def, state.titleScale);

  // Subtitle under the title.
  ctx.save();
  ctx.fillStyle = def.sub;
  ctx.font = `700 ${Math.max(13, W * 0.024)}px Arial, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${W * 0.005}px`; } catch { /* ignore */ }
  ctx.fillText(state.subtitle || '', padX, titleY + availH * 0.13);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }

  drawFooter(ctx, W, H - availH * 0.10, def, state.footer || '', W);
}

function drawMagazine(ctx, W, H, state, def, fx, compare) {
  // Scrim so the giant title stays readable over any photo.
  const scrim = ctx.createLinearGradient(0, H * 0.30, 0, H);
  scrim.addColorStop(0, 'rgba(10,2,25,0)');
  scrim.addColorStop(0.55, 'rgba(10,2,25,0.35)');
  scrim.addColorStop(1, 'rgba(10,2,25,0.62)');
  ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, H);

  // VI badge: double ring with the mark inside — never empty.
  if (fx.sun && !compare) {
    const r = Math.min(W, H) * 0.055;
    const cx = W - r - W * 0.035, cy = r + H * 0.03;
    ctx.save();
    ctx.strokeStyle = def.badge; ctx.lineWidth = Math.max(3, r * 0.09);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = def.badge;
    ctx.font = `900 ${r * 0.72}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VI', cx, cy + r * 0.03);
    ctx.restore();
  }

  const padX = W * 0.045;
  const pillH = Math.min(H * 0.042, W * 0.05);
  const pillY = H * 0.50;
  drawPill(ctx, state.pill || '', padX, pillY, def, pillH);

  // Giant stacked title, two lines, left-aligned like a magazine masthead —
  // keeps the lettering off the face in wide frames.
  const words = (state.title || 'SUNSET HEIST').toUpperCase().split(/\s+/);
  const lines = words.length > 1
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [words[0] || '', ''];
  const base = Math.min(H * 0.16, W * 0.20);
  let y = pillY + pillH + base * 1.05;
  for (const line of lines) {
    if (!line) continue;
    drawTitle(ctx, line, padX, y, W - padX * 2, base, def, state.titleScale, 'left');
    y += base * 1.02;
  }

  // Footer row at the very bottom.
  drawFooter(ctx, W, H - H * 0.035, def, `${state.footer || ''}  \u2022  VICE CITY`, W);
}
