/* ============================================================
   EFFECTS · bokeh background, confetti, fireworks, typewriter,
             balloons.  All hand-rolled canvas - no CDN, works
             fully offline.
   ============================================================ */

import { $, rand, pick, prefersReducedMotion } from './util.js';

const GOLD = ['#f5c26b', '#ffe0a8', '#c99441'];
const BLUSH = ['#ff8fab', '#ffc2d1', '#c9184a'];
const PARTY = [...GOLD, ...BLUSH, '#fff8f0', '#b892ff'];

/* ── shared canvas sizing ─────────────────────────────────── */
function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { clientWidth: w, clientHeight: h } = canvas;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* ═══════════════════════════════════════════════════════════
   1 · AMBIENT BOKEH - slow drifting gold dust, always running
   ═══════════════════════════════════════════════════════════ */
export function startBokeh(canvas) {
  if (prefersReducedMotion()) return;

  let { ctx, w, h } = fitCanvas(canvas);
  let motes = [];

  const seed = () => {
    const count = Math.round(Math.min(w, 900) / 18);
    motes = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(.8, 3.4),
      vy: rand(-.16, -.03),
      vx: rand(-.12, .12),
      a: rand(.12, .5),
      hue: pick(GOLD),
      phase: rand(0, Math.PI * 2),
    }));
  };
  seed();

  const onResize = () => { ({ ctx, w, h } = fitCanvas(canvas)); seed(); };
  window.addEventListener('resize', onResize, { passive: true });

  let t = 0;
  (function loop() {
    t += 0.012;
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.x += m.vx + Math.sin(t + m.phase) * .18;
      m.y += m.vy;
      if (m.y < -12) { m.y = h + 12; m.x = rand(0, w); }
      if (m.x < -12) m.x = w + 12;
      if (m.x > w + 12) m.x = -12;

      const twinkle = m.a * (0.65 + 0.35 * Math.sin(t * 2.2 + m.phase));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = m.hue;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })();
}

/* ═══════════════════════════════════════════════════════════
   2 · FX CANVAS - confetti + fireworks share one particle pool
       and one rAF loop that sleeps when there is nothing to draw
   ═══════════════════════════════════════════════════════════ */
let fx = null;

export function initFx(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  fx = { canvas, ctx, w, h, particles: [], running: false };

  window.addEventListener('resize', () => {
    const s = fitCanvas(canvas);
    fx.ctx = s.ctx; fx.w = s.w; fx.h = s.h;
  }, { passive: true });
}

function ensureLoop() {
  if (!fx || fx.running) return;
  fx.running = true;

  (function frame() {
    const { ctx, w, h } = fx;
    ctx.clearRect(0, 0, w, h);

    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      p.spin += p.spinRate;

      if (p.life <= 0 || p.y > h + 60) { fx.particles.splice(i, 1); continue; }

      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / p.fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else { // heart
        const s = p.size / 14;
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.bezierCurveTo(-7, -3, -4, -9, 0, -5);
        ctx.bezierCurveTo(4, -9, 7, -3, 0, 4);
        ctx.fill();
      }
      ctx.restore();
    }

    if (fx.particles.length) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, w, h);
      fx.running = false;
    }
  })();
}

function spawn(p) {
  // Hard cap protects low-end phones from a runaway pool.
  if (fx.particles.length > 900) return;
  fx.particles.push(p);
}

/**
 * Confetti burst.
 * @param {object} opts  x/y as 0-1 fractions of the viewport.
 */
export function confetti({ x = .5, y = .45, count = 110, spread = Math.PI * 2, power = 9, colors = PARTY } = {}) {
  if (!fx) return;
  if (prefersReducedMotion()) count = Math.min(count, 24);

  const ox = x * fx.w;
  const oy = y * fx.h;

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + rand(-spread / 2, spread / 2);
    const speed = rand(power * .35, power);
    spawn({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: rand(.14, .24),
      drag: .985,
      size: rand(6, 13),
      color: pick(colors),
      shape: pick(['rect', 'rect', 'circle', 'heart']),
      spin: rand(0, Math.PI * 2),
      spinRate: rand(-.22, .22),
      life: rand(90, 190),
      fade: 55,
    });
  }
  ensureLoop();
}

/** Confetti raining from the top edge - good for a sustained celebration. */
export function confettiRain(durationMs = 4000) {
  if (!fx) return;
  const reduced = prefersReducedMotion();
  const every = reduced ? 340 : 110;
  const perTick = reduced ? 2 : 7;
  const end = performance.now() + durationMs;

  (function tick() {
    if (performance.now() > end) return;
    for (let i = 0; i < perTick; i++) {
      spawn({
        x: rand(0, fx.w), y: -20,
        vx: rand(-1.4, 1.4),
        vy: rand(1.5, 3.6),
        gravity: rand(.04, .1),
        drag: .995,
        size: rand(6, 12),
        color: pick(PARTY),
        shape: pick(['rect', 'circle', 'heart']),
        spin: rand(0, Math.PI * 2),
        spinRate: rand(-.16, .16),
        life: rand(220, 380),
        fade: 70,
      });
    }
    ensureLoop();
    setTimeout(tick, every);
  })();
}

/** A single firework shell bursting at (x, y) - 0-1 viewport fractions. */
export function firework(x = rand(.15, .85), y = rand(.15, .5)) {
  if (!fx) return;
  const reduced = prefersReducedMotion();
  const ox = x * fx.w;
  const oy = y * fx.h;
  const hue = pick([GOLD, BLUSH, ['#b892ff', '#d9c2ff'], ['#7ee8fa', '#c2f4ff']]);
  const count = reduced ? 18 : 64;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-.06, .06);
    const speed = rand(2.4, 6.4);
    spawn({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: .055,
      drag: .968,
      size: rand(3, 6),
      color: pick(hue),
      shape: 'circle',
      spin: 0, spinRate: 0,
      life: rand(60, 110),
      fade: 60,
    });
  }
  ensureLoop();
}

/** Repeating fireworks show. Returns a stop() function. */
export function fireworkShow(intervalMs = 900) {
  let stopped = false;
  const gap = prefersReducedMotion() ? intervalMs * 3 : intervalMs;
  (function tick() {
    if (stopped) return;
    firework();
    setTimeout(tick, gap + rand(-260, 420));
  })();
  return () => { stopped = true; };
}

/* ═══════════════════════════════════════════════════════════
   3 · TYPEWRITER
   ═══════════════════════════════════════════════════════════ */
export function typewriter(el, text, { speed = 78, startDelay = 400 } = {}) {
  return new Promise(resolve => {
    el.textContent = '';
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    el.append(caret);

    if (prefersReducedMotion()) {
      caret.before(text);
      caret.classList.add('is-done');
      resolve();
      return;
    }

    let i = 0;
    setTimeout(function step() {
      if (i >= text.length) {
        caret.classList.add('is-done');
        resolve();
        return;
      }
      caret.before(text[i]);
      i++;
      // Linger on punctuation so it reads like speech, not a printer.
      const ch = text[i - 1];
      const pause = /[,.!?-]/.test(ch) ? speed * 5 : speed + rand(-22, 22);
      setTimeout(step, pause);
    }, startDelay);
  });
}

/* ═══════════════════════════════════════════════════════════
   4 · BALLOONS (DOM, cheap, landing scene only)
   ═══════════════════════════════════════════════════════════ */
export function spawnBalloons(container, count = 9) {
  if (prefersReducedMotion() || !container) return;
  const colors = ['#ff8fab', '#f5c26b', '#b892ff', '#ffc2d1', '#7ee8fa'];

  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'balloon';
    const c = colors[i % colors.length];
    b.style.background = `radial-gradient(circle at 32% 28%, #fff9, ${c} 45%, ${c})`;
    b.style.left = `${rand(2, 92)}%`;
    b.style.animationDuration = `${rand(15, 27)}s`;
    b.style.animationDelay = `${rand(0, 14)}s`;
    b.style.setProperty('--drift', `${rand(-70, 70)}px`);
    const scale = rand(.6, 1.25);
    b.style.width = `${44 * scale}px`;
    b.style.height = `${56 * scale}px`;
    container.append(b);
  }
}
