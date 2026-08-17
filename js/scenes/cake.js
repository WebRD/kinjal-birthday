/* ============================================================
   SCENE 5 · Make a Wish - candles you tap out, or actually blow
             out with the microphone.
   ============================================================ */

import { CONTENT } from '../content.js';
import { $, wait, prefersReducedMotion } from '../util.js';
import { confetti, confettiRain } from '../effects.js';

let built = false;
let finished = false;
let mic = null;           // { stream, ctx, raf } while listening

export function buildCake() {
  if (built) return;
  built = true;

  $('#cake-icing').textContent = CONTENT.cake.iceName ?? '';
  sprinkle();

  const wrap = $('#cake-candles');
  const count = Math.max(1, CONTENT.cake.candles ?? 5);

  for (let i = 0; i < count; i++) {
    const c = document.createElement('button');
    c.className = 'candle';
    c.type = 'button';
    c.setAttribute('aria-label', `Blow out candle ${i + 1}`);

    const wick = document.createElement('span');
    wick.className = 'candle__wick';
    const flame = document.createElement('span');
    flame.className = 'cake__flame';
    // Desync the flicker so the flames don't pulse in lockstep.
    flame.style.animationDelay = `${-i * 0.11}s`;
    flame.style.animationDuration = `${0.3 + i * 0.03}s`;

    c.append(wick, flame);
    c.addEventListener('click', () => blowOut(c));
    wrap.append(c);
  }

  $('#cake-prompt').textContent = CONTENT.cake.promptTap;
  $('#btn-mic').addEventListener('click', startMic);
}

/* Scatter sprinkles on the bottom tier. Positions are derived from the index,
   not Math.random, so they don't jump around on a replay. */
function sprinkle() {
  const host = $('#cake-sprinkles');
  const colors = ['#ff8fab', '#f5c26b', '#b892ff', '#7ee8fa', '#fff8f0'];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('i');
    s.style.left = `${(i * 37) % 94}%`;
    s.style.top = `${(i * 53) % 78}%`;
    s.style.background = colors[i % colors.length];
    s.style.transform = `rotate(${(i * 47) % 180 - 90}deg)`;
    host.append(s);
  }
}

function liveCandles() {
  return [...document.querySelectorAll('.candle:not(.is-out)')];
}

function blowOut(candle) {
  if (!candle || candle.classList.contains('is-out')) return;

  candle.classList.add('is-out');
  candle.disabled = true;

  if (!prefersReducedMotion()) {
    const smoke = document.createElement('span');
    smoke.className = 'candle__smoke';
    candle.append(smoke);
    smoke.addEventListener('animationend', () => smoke.remove(), { once: true });
  }

  if (!liveCandles().length) finish();
}

async function finish() {
  if (finished) return;
  finished = true;

  stopMic();
  $('#cake-prompt').textContent = CONTENT.cake.promptDone;
  $('#btn-mic').classList.add('is-hidden');
  $('#mic-status').textContent = '';

  const scene = $('.scene--cake');
  scene.classList.add('is-dark');

  await wait(prefersReducedMotion() ? 200 : 900);

  scene.classList.remove('is-dark');
  confetti({ y: .55, count: 130, power: 12 });
  confettiRain(2600);

  const afterword = $('#cake-afterword');
  afterword.textContent = CONTENT.cake.afterword;
  afterword.classList.add('is-shown');

  await wait(600);
  $('#btn-cake-next').classList.remove('is-hidden');
}

/* ── Microphone blow detection ────────────────────────────────
   Optional garnish. Tapping always works; if the mic is denied,
   blocked by an insecure origin, or unsupported, we say so kindly
   and carry on.
   ─────────────────────────────────────────────────────────── */
async function startMic() {
  const status = $('#mic-status');

  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    status.textContent = CONTENT.cake.micDenied;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = .55;
    source.connect(analyser);

    mic = { stream, ctx, raf: 0 };

    $('#btn-mic').classList.add('is-hidden');
    $('#cake-prompt').textContent = CONTENT.cake.promptBlow;
    status.textContent = CONTENT.cake.micListening;
    status.classList.add('is-live');

    listen(analyser);
  } catch {
    status.textContent = CONTENT.cake.micDenied;
  }
}

function listen(analyser) {
  const buf = new Float32Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);

  let sustained = 0;   // frames of continuous blowing
  let cooldown = 0;    // frames before the next candle can go out

  const tick = () => {
    if (!mic) return;

    analyser.getFloatTimeDomainData(buf);
    analyser.getByteFrequencyData(freq);

    // Loudness (RMS) …
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);

    // … plus "is the energy mostly low-frequency?", which separates a breath
    // from speech or music. Blowing is broadband rumble concentrated low down.
    const cut = Math.floor(freq.length * 0.12);
    let low = 0, all = 0;
    for (let i = 0; i < freq.length; i++) {
      all += freq[i];
      if (i < cut) low += freq[i];
    }
    const lowRatio = all > 0 ? low / all : 0;

    const blowing = rms > 0.055 && lowRatio > 0.42;

    if (cooldown > 0) cooldown--;
    sustained = blowing ? sustained + 1 : Math.max(0, sustained - 2);

    // ~6 frames (100ms) of sustained breath puts one candle out at a time,
    // so it feels like she's actually blowing them out one by one.
    if (sustained > 6 && cooldown === 0) {
      blowOut(liveCandles()[0]);
      sustained = 0;
      cooldown = 22;
    }

    mic.raf = requestAnimationFrame(tick);
  };

  tick();
}

export function stopMic() {
  if (!mic) return;
  cancelAnimationFrame(mic.raf);
  mic.stream.getTracks().forEach(t => t.stop());
  mic.ctx.close().catch(() => {});
  mic = null;
  $('#mic-status')?.classList.remove('is-live');
}

/** Reset the whole scene so Replay gives her a fresh cake. */
export function resetCake() {
  finished = false;
  stopMic();
  document.querySelectorAll('.candle').forEach(c => {
    c.classList.remove('is-out');
    c.disabled = false;
  });
  $('.scene--cake')?.classList.remove('is-dark');
  $('#cake-prompt').textContent = CONTENT.cake.promptTap;
  $('#cake-afterword').classList.remove('is-shown');
  $('#btn-cake-next').classList.add('is-hidden');
  $('#btn-mic').classList.remove('is-hidden');
  $('#mic-status').textContent = '';
}
