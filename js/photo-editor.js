// Fanovana sary tsotra: manodina, manakaiky (zoom), mamindra, hazavana, contraste, loko.
import { html, useState, useEffect, useRef } from './lib.js?v=202610291451';
import { tr } from './i18n.js?v=202610291451';

const OUT = 1200; // sary efamira 1200 × 1200

export function PhotoEditor({ src, onCancel, onSave }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState({ rot: 0, zoom: 1, x: 0, y: 0, bright: 100, contrast: 100, sat: 100 });
  const drag = useRef(null);
  const set = (k, v) => setS((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setImg(i);
    i.onerror = () => setErr(tr('Impossible de charger la photo.', 'Could not load the photo.', 'Tsy voasokatra ny sary.'));
    i.src = src;
  }, [src]);

  function draw(canvas, size) {
    if (!img || !canvas) return;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.filter = `brightness(${s.bright}%) contrast(${s.contrast}%) saturate(${s.sat}%)`;
    ctx.translate(size / 2 + (s.x / 100) * size, size / 2 + (s.y / 100) * size);
    ctx.rotate((s.rot * Math.PI) / 180);
    const rotated = s.rot % 180 !== 0;
    const w = rotated ? img.naturalHeight : img.naturalWidth;
    const h = rotated ? img.naturalWidth : img.naturalHeight;
    const cover = Math.max(size / w, size / h) * s.zoom; // mameno ny efamira
    ctx.drawImage(img, (-img.naturalWidth * cover) / 2, (-img.naturalHeight * cover) / 2, img.naturalWidth * cover, img.naturalHeight * cover);
    ctx.restore();
  }

  useEffect(() => { draw(canvasRef.current, 600); }, [img, s]);

  function onDown(e) {
    const p = e.touches ? e.touches[0] : e;
    drag.current = { x: p.clientX, y: p.clientY, sx: s.x, sy: s.y, w: canvasRef.current.getBoundingClientRect().width };
  }
  function onMove(e) {
    if (!drag.current) return;
    const p = e.touches ? e.touches[0] : e;
    const d = drag.current;
    setS((o) => ({ ...o, x: d.sx + ((p.clientX - d.x) / d.w) * 100, y: d.sy + ((p.clientY - d.y) / d.w) * 100 }));
    if (e.cancelable) e.preventDefault();
  }
  const onUp = () => { drag.current = null; };

  async function save() {
    setBusy(true);
    try {
      const c = document.createElement('canvas');
      draw(c, OUT);
      const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('export');
      await onSave(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    } catch (e) {
      setErr(tr('Enregistrement impossible : ', 'Could not save: ', 'Tsy voatahiry: ') + (e.message || e));
    } finally { setBusy(false); }
  }

  const slider = (k, label, min, max, step = 1) => html`<label class="ed-slider"><span>${label}</span>
    <input type="range" min=${min} max=${max} step=${step} value=${s[k]} onInput=${(e) => set(k, +e.target.value)} /></label>`;

  return html`<div class="modal-back" onClick=${(e) => { if (e.target === e.currentTarget) onCancel(); }}>
    <div class="modal wide editor" role="dialog" aria-modal="true">
      <header class="card-head"><h2>${tr('Modifier la photo', 'Edit photo', 'Ovay ny sary')}</h2><button class="btn ghost" onClick=${onCancel} aria-label=${tr('Fermer', 'Close', 'Hidio')}>✕</button></header>
      ${err && html`<p class="warn-box">${err}</p>`}
      <div class="editor-grid">
        <div class="editor-canvas">
          <canvas ref=${canvasRef} onMouseDown=${onDown} onMouseMove=${onMove} onMouseUp=${onUp} onMouseLeave=${onUp}
            onTouchStart=${onDown} onTouchMove=${onMove} onTouchEnd=${onUp}></canvas>
          <p class="hint">${tr('Glissez la photo pour la déplacer. Le cadre carré est ce qui sera enregistré.', 'Drag the photo to move it. The square frame is what will be saved.', 'Sintony ny sary hamindrana azy. Ny ao anatin\'ny efamira no hotehirizina.')}</p>
        </div>
        <div class="editor-controls">
          <div class="row gap wrap">
            <button class="btn small" onClick=${() => set('rot', (s.rot + 270) % 360)}>⟲ ${tr('Pivoter', 'Rotate', 'Ahodino')}</button>
            <button class="btn small" onClick=${() => set('rot', (s.rot + 90) % 360)}>⟳ ${tr('Pivoter', 'Rotate', 'Ahodino')}</button>
          </div>
          ${slider('zoom', tr('Zoom (recadrer)', 'Zoom (crop)', 'Zoom (tapahana)'), 1, 3, 0.01)}
          ${slider('bright', tr('Luminosité', 'Brightness', 'Hazavana'), 60, 150)}
          ${slider('contrast', tr('Contraste', 'Contrast', 'Contraste'), 60, 150)}
          ${slider('sat', tr('Couleurs', 'Colour', 'Loko'), 50, 170)}
          <button class="btn small ghost" onClick=${() => setS({ rot: 0, zoom: 1, x: 0, y: 0, bright: 100, contrast: 100, sat: 100 })}>${tr('Réinitialiser', 'Reset', 'Avereno')}</button>
          <div class="row gap">
            <button class="btn primary" disabled=${busy || !img} onClick=${save}>${busy ? tr('Enregistrement…', 'Saving…', 'Mitahiry…') : tr('Enregistrer la photo', 'Save photo', 'Tehirizo ny sary')}</button>
            <button class="btn ghost" onClick=${onCancel}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
