// Generates the benzene-ring favicon via Canvas at runtime.
// Canvas-generated data URIs bypass the browser's favicon cache.

(function () {
  const SIZE = 64;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const cx = SIZE / 2, cy = SIZE / 2;

  // Rounded-rect background
  const r = SIZE * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(SIZE - r, 0);
  ctx.quadraticCurveTo(SIZE, 0, SIZE, r);
  ctx.lineTo(SIZE, SIZE - r);
  ctx.quadraticCurveTo(SIZE, SIZE, SIZE - r, SIZE);
  ctx.lineTo(r, SIZE);
  ctx.quadraticCurveTo(0, SIZE, 0, SIZE - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#2563eb';
  ctx.fill();

  // Outer hexagon (flat-top, 6 vertices)
  const hexR = SIZE * 0.36;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // 0° = right, flat-top
    const x = cx + hexR * Math.cos(angle);
    const y = cy + hexR * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = SIZE * 0.063;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Inner circle (aromatic π system)
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.175, 0, Math.PI * 2);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = SIZE * 0.052;
  ctx.stroke();

  // Inject as favicon
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = c.toDataURL('image/png');
})();
