// Offline Canvas compositor. All imagery belongs to this project.
export function renderFrame(ctx, images, shots, time) {
  const W = 1280;
  const H = 720;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const smooth = (n) => {
    const x = clamp(n);
    return x * x * (3 - 2 * x);
  };
  const index = Math.max(
    0,
    shots.findLastIndex((s) => time >= s.start),
  );
  const shot = shots[index];
  const elapsed = time - shot.start;
  const progress = clamp(elapsed / shot.duration);
  const picture = images[shot.image];
  ctx.fillStyle = '#071619';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const base = Math.max(W / picture.width, H / picture.height);
  const zoom = 1.015 + progress * 0.045;
  const scale = base * zoom;
  const dw = picture.width * scale,
    dh = picture.height * scale;
  const x = (W - dw) * (shot.id === 'journey' ? 0.7 : 0.4);
  const y = (H - dh) * (shot.image === 'valley' ? 0.32 : 0.5);
  ctx.drawImage(picture, x, y, dw, dh);
  // Light is animated in source coordinates, so it stays attached to each lamp.
  const glow = (px, py, radius, strength) => {
    const cx = x + px * dw,
      cy = y + py * dh,
      r = radius * dw;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,222,153,${strength})`);
    g.addColorStop(0.12, `rgba(255,193,93,${strength * 0.8})`);
    g.addColorStop(1, 'rgba(255,166,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  if (shot.image === 'valley') {
    const darkness =
      shot.id === 'storm' ? 0.13 + 0.53 * smooth(elapsed / 5) : 0.13;
    ctx.fillStyle = `rgba(4,15,28,${darkness})`;
    ctx.fillRect(0, 0, W, H);
    const lamps = [
      [0.361, 0.497, 0.035],
      [0.534, 0.509, 0.027],
      [0.612, 0.476, 0.021],
      [0.687, 0.455, 0.018],
      [0.747, 0.383, 0.014],
      [0.779, 0.381, 0.011],
      [0.805, 0.334, 0.009],
      [0.866, 0.307, 0.007],
    ];
    lamps.forEach(([px, py, r], i) => {
      const strength =
        shot.id === 'road'
          ? 0.9
          : shot.id === 'storm'
            ? 0.9 * (1 - smooth((elapsed - 2.7 - i * 0.3) / 0.9))
            : 0;
      glow(px, py, r, strength * (0.96 + 0.04 * Math.sin(time * 2 + i)));
    });
  }
  // Separate foreground rain planes; the workshop has dust motes indoors.
  const indoor = shot.id === 'lumi';
  if (!indoor) {
    ctx.save();
    if (shot.id === 'silence') {
      // Rain belongs outside the post office, behind the dry letters.
      ctx.beginPath();
      [
        [0.61, 0.16],
        [0.86, 0.16],
        [0.86, 0.65],
        [0.62, 0.77],
      ].forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(x + px * dw, y + py * dh);
        else ctx.lineTo(x + px * dw, y + py * dh);
      });
      ctx.closePath();
      ctx.clip();
    }
    const strength =
      shot.id === 'storm' ? 0.15 + 0.28 * smooth(elapsed / 3) : 0.07;
    for (let layer = 0; layer < 2; layer++) {
      ctx.strokeStyle = `rgba(184,212,220,${strength * (layer ? 1 : 0.55)})`;
      ctx.lineWidth = layer ? 1.2 : 0.6;
      ctx.beginPath();
      for (let n = 0; n < 135; n++) {
        const px =
          ((((n * 139.7 + layer * 53 - time * (layer ? 72 : 38)) % (W + 100)) +
            W +
            100) %
            (W + 100)) -
          50;
        const py = ((n * 83.3 + time * (layer ? 570 : 330)) % (H + 70)) - 35;
        ctx.moveTo(px, py);
        ctx.lineTo(px - 5, py + (layer ? 24 : 12));
      }
      ctx.stroke();
    }
    ctx.restore();
  } else {
    for (let n = 0; n < 42; n++) {
      const px = (n * 173.7 + Math.sin(time * 0.3 + n) * 15) % W;
      const py = (((n * 97.1 - time * (4 + (n % 4))) % H) + H) % H;
      ctx.fillStyle = `rgba(255,218,144,${0.1 + 0.14 * (0.5 + 0.5 * Math.sin(time + n))})`;
      ctx.beginPath();
      ctx.arc(px, py, 1 + (n % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const vignette = ctx.createRadialGradient(
    W * 0.5,
    H * 0.45,
    H * 0.2,
    W * 0.5,
    H * 0.45,
    W * 0.65,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(2,9,13,.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  if (shot.id === 'journey') {
    const title = smooth((elapsed - shot.duration + 5) / 1.5);
    ctx.fillStyle = `rgba(4,17,22,${title * 0.55})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = title;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f6deb1';
    ctx.shadowColor = '#edb75b';
    ctx.shadowBlur = 18;
    ctx.font = '52px Georgia';
    ctx.fillText('ЛЮМИ', W / 2, H * 0.42);
    ctx.shadowBlur = 0;
    ctx.font = '23px Georgia';
    ctx.fillText('И ДОРОГА ОГНЕЙ', W / 2, H * 0.5);
    ctx.fillStyle = '#c7cbbd';
    ctx.font = '17px Georgia';
    ctx.fillText('Каждое письмо кого-то ждёт', W / 2, H * 0.58);
    ctx.globalAlpha = 1;
  }
  // Fade through dark keeps the spatial changes legible without flashing.
  const fade = Math.min(
    smooth(elapsed / 0.7),
    smooth((shot.duration - elapsed) / 0.65),
  );
  ctx.fillStyle = `rgba(4,13,18,${1 - fade})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
