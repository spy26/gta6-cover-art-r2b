// Vice Cover Studio — editor wiring, shot mode, and PNG export.
// All state lives in one object; every control re-renders the same canvas
// the exporter draws from, so what you see is what the PNG holds.
import { drawCover, defaultState, applyLayoutDefaults, LAYOUTS, PRESETS, EXPORT_SIZES } from './cover.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // 'cover' | 'editor' | null

const state = defaultState();
let images = {};          // name -> HTMLImageElement
let customImages = [];    // uploaded photos, named custom0..2
let selectedPanel = 0;
let compareHeld = false;
let renderQueued = false;

const PRESET_LABELS = {
  sunset: 'Sunset Strip', neon: 'Neon Nights', golden: 'Golden Hour',
  midnight: 'Midnight Vice', postcard: 'Postcard Vice',
};
const LAYOUT_LABELS = {
  diagonal: 'Diagonal Vice', hero: 'Hero Split', triptych: 'Triptych',
  magazine: 'Magazine', duo: 'Duo Portrait',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSamples() {
  const [b, p] = await Promise.all([
    loadImage('./samples/boulevard.jpg'),
    loadImage('./samples/pier.jpg'),
  ]);
  images = { boulevard: b, pier: p };
}

function currentImages() {
  const all = { ...images };
  customImages.forEach((img, i) => { if (img) all['custom' + i] = img; });
  return all;
}

function render() {
  const canvas = $('cover');
  const ctx = canvas.getContext('2d');
  const st = { ...state, panels: state.panels.map((p) => ({ ...p })), compare: compareHeld };
  drawCover(ctx, canvas.width, canvas.height, st, currentImages());
  window.__ready = true;
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function fitPreview() {
  // Preview canvas keeps the export aspect of the chosen size.
  const size = EXPORT_SIZES[+($('size')?.value || 0)] || EXPORT_SIZES[0];
  const canvas = $('cover');
  canvas.width = size.w; canvas.height = size.h;
  const box = $('stage');
  if (box) {
    const maxW = Math.min(560, box.clientWidth || 560);
    const scale = Math.min(maxW / size.w, 560 / size.h, 1);
    canvas.style.width = Math.round(size.w * scale) + 'px';
    canvas.style.height = Math.round(size.h * scale) + 'px';
  }
  queueRender();
}

function refreshPanelControls() {
  const crop = state.panels[selectedPanel];
  const wrap = $('panel-controls');
  if (!wrap || !crop) return;
  const slots = state.layout === 'magazine' ? 1 : state.layout === 'duo' ? 2 : 3;
  wrap.querySelectorAll('[data-panel]').forEach((btn) => {
    const i = +btn.dataset.panel;
    btn.hidden = i >= slots;
    btn.classList.toggle('active', i === selectedPanel);
    btn.textContent = `Panel ${i + 1} · ${photoLabel(state.panels[i]?.photo)}`;
  });
  $('zoom').value = crop.zoom;
  $('panx').value = crop.x;
  $('pany').value = crop.y;
  $('flip').checked = !!crop.flip;
  $('zoom-val').textContent = crop.zoom.toFixed(2) + '×';
}

function photoLabel(name) {
  if (!name) return '—';
  if (name === 'boulevard') return 'Boulevard';
  if (name === 'pier') return 'Pier';
  const i = +(name.replace('custom', ''));
  return 'Upload ' + (i + 1);
}

function photoOptions() {
  const opts = [
    ['boulevard', 'Boulevard (sample)'],
    ['pier', 'Pier (sample)'],
  ];
  customImages.forEach((img, i) => { if (img) opts.push(['custom' + i, 'Upload ' + (i + 1)]); });
  return opts;
}

function buildPhotoSelects() {
  document.querySelectorAll('.photo-select').forEach((sel) => {
    const slot = +sel.dataset.slot;
    sel.innerHTML = '';
    for (const [val, label] of photoOptions()) {
      const o = document.createElement('option');
      o.value = val; o.textContent = label;
      sel.appendChild(o);
    }
    sel.value = state.panels[slot]?.photo || 'boulevard';
  });
}

function syncInputs() {
  $('title').value = state.title;
  $('pill').value = state.pill;
  $('subtitle').value = state.subtitle;
  $('footer').value = state.footer;
  $('title-scale').value = state.titleScale;
  $('title-scale-val').textContent = Math.round(state.titleScale * 100) + '%';
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === state.preset));
  document.querySelectorAll('[data-fx]').forEach((c) => { c.checked = !!state.fx[c.dataset.fx]; });
  buildPhotoSelects();
  refreshPanelControls();
}

function setLayout(layout) {
  state.layout = layout;
  applyLayoutDefaults(state);
  selectedPanel = 0;
  syncInputs();
  queueRender();
}

function setPreset(preset) {
  state.preset = preset;
  syncInputs();
  queueRender();
}

function randomize() {
  const layouts = LAYOUTS;
  const presets = PRESETS;
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.preset = presets[Math.floor(Math.random() * presets.length)];
  applyLayoutDefaults(state);
  // Shuffle which sample each panel shows (magazine keeps one photo).
  const pool = ['boulevard', 'pier'];
  state.panels.forEach((p) => { p.photo = pool[Math.floor(Math.random() * pool.length)]; });
  if (state.layout === 'diagonal') state.panels[2].zoom = 1.15;
  state.titleScale = 0.9 + Math.random() * 0.2;
  selectedPanel = 0;
  syncInputs();
  queueRender();
}

async function exportPNG() {
  const size = EXPORT_SIZES[+($('size')?.value || 0)] || EXPORT_SIZES[0];
  const off = document.createElement('canvas');
  off.width = size.w; off.height = size.h;
  const st = { ...state, panels: state.panels.map((p) => ({ ...p })), compare: false };
  drawCover(off.getContext('2d'), size.w, size.h, st, currentImages());
  const blob = await new Promise((res) => off.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${state.layout}-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('status').textContent = `Exported ${size.w} × ${size.h} PNG.`;
}

// Drag on the preview pans the selected panel's crop; wheel zooms it.
function bindCanvasDrag() {
  const canvas = $('cover');
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, px: state.panels[selectedPanel].x, py: state.panels[selectedPanel].y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const crop = state.panels[selectedPanel];
    crop.x = Math.max(-1, Math.min(1, drag.px + (e.clientX - drag.x) / rect.width * 4));
    crop.y = Math.max(-1, Math.min(1, drag.py + (e.clientY - drag.y) / rect.height * 4));
    refreshPanelControls();
    queueRender();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const crop = state.panels[selectedPanel];
    crop.zoom = Math.max(1, Math.min(3, crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    refreshPanelControls();
    queueRender();
  }, { passive: false });
}

function buildEditor() {
  const layoutRow = $('layouts');
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.layout = l; b.textContent = LAYOUT_LABELS[l];
    b.addEventListener('click', () => setLayout(l));
    layoutRow.appendChild(b);
  }
  const presetRow = $('presets');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.preset = p; b.textContent = PRESET_LABELS[p];
    b.addEventListener('click', () => setPreset(p));
    presetRow.appendChild(b);
  }
  const sizeSel = $('size');
  EXPORT_SIZES.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = s.label;
    sizeSel.appendChild(o);
  });
  sizeSel.addEventListener('change', fitPreview);

  document.querySelectorAll('.photo-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      state.panels[+sel.dataset.slot].photo = sel.value;
      refreshPanelControls();
      queueRender();
    });
  });
  document.querySelectorAll('[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => { selectedPanel = +btn.dataset.panel; refreshPanelControls(); });
  });

  $('zoom').addEventListener('input', (e) => { state.panels[selectedPanel].zoom = +e.target.value; refreshPanelControls(); queueRender(); });
  $('panx').addEventListener('input', (e) => { state.panels[selectedPanel].x = +e.target.value; queueRender(); });
  $('pany').addEventListener('input', (e) => { state.panels[selectedPanel].y = +e.target.value; queueRender(); });
  $('flip').addEventListener('change', (e) => { state.panels[selectedPanel].flip = e.target.checked; queueRender(); });

  $('title').addEventListener('input', (e) => { state.title = e.target.value; queueRender(); });
  $('pill').addEventListener('input', (e) => { state.pill = e.target.value; queueRender(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; queueRender(); });
  $('footer').addEventListener('input', (e) => { state.footer = e.target.value; queueRender(); });
  $('title-scale').addEventListener('input', (e) => {
    state.titleScale = +e.target.value;
    $('title-scale-val').textContent = Math.round(state.titleScale * 100) + '%';
    queueRender();
  });

  document.querySelectorAll('[data-fx]').forEach((c) => {
    c.addEventListener('change', () => { state.fx[c.dataset.fx] = c.checked; queueRender(); });
  });

  $('randomize').addEventListener('click', randomize);
  $('export').addEventListener('click', exportPNG);

  const compare = $('compare');
  const hold = (on) => { compareHeld = on; compare.classList.toggle('holding', on); queueRender(); };
  compare.addEventListener('pointerdown', () => hold(true));
  compare.addEventListener('pointerup', () => hold(false));
  compare.addEventListener('pointerleave', () => hold(false));

  document.querySelectorAll('.upload').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const slot = +input.dataset.slot;
      const img = await loadImage(URL.createObjectURL(file));
      customImages[slot] = img;
      state.panels.forEach((p, i) => { if (i === slot) p.photo = 'custom' + slot; });
      buildPhotoSelects();
      refreshPanelControls();
      queueRender();
      $('status').textContent = `Photo ${slot + 1} loaded — kept on your machine, never uploaded.`;
    });
  });

  bindCanvasDrag();
  window.addEventListener('resize', fitPreview);
}

// Shot mode: ?shot=cover|editor&layout&preset&photo&title&size=WxH
function applyShotParams() {
  if (params.get('layout') && LAYOUTS.includes(params.get('layout'))) state.layout = params.get('layout');
  if (params.get('preset') && PRESETS.includes(params.get('preset'))) state.preset = params.get('preset');
  if (params.get('title')) state.title = params.get('title');
  if (params.get('pill')) state.pill = params.get('pill');
  if (params.get('photo')) {
    const ph = params.get('photo');
    if (ph === 'mix') { /* keep per-layout defaults */ }
    else state.panels.forEach((p) => { p.photo = ph; });
  }
  applyLayoutDefaults(state);
  if (params.get('photo') === 'mix') {
    // mix = boulevard hero + pier middle, like the benchmark set.
    state.panels[1].photo = 'pier';
  }
  const size = params.get('size');
  if (size) {
    const [w, h] = size.split('x').map(Number);
    if (w > 0 && h > 0) {
      const canvas = $('cover');
      canvas.width = w; canvas.height = h;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
  }
}

async function main() {
  await loadSamples();
  applyShotParams();
  if (SHOT === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = $('cover');
    if (!params.get('size')) { canvas.width = 1080; canvas.height = 1080; }
    render();
    return;
  }
  buildEditor();
  if (SHOT === 'editor') document.body.classList.add('shot-editor');
  syncInputs();
  fitPreview();
}

main().catch((err) => {
  const st = $('status');
  if (st) st.textContent = 'Could not load sample photos: ' + err.message;
  console.error(err);
});
