/* ============================================================
   SCENE · COUNTDOWN - the locked door in front of her birthday.

   Shown instead of the journey while the reveal date is still in
   the future. When the clock runs out it opens itself, no reload.
   ============================================================ */

import { CONTENT } from '../content.js';
import { $ } from '../util.js';
import { nowMs, revealAt, formatRevealDate, formatRevealTime } from '../reveal.js';

/* label key, milliseconds in one unit */
const UNITS = [
  ['days', 864e5],
  ['hours', 36e5],
  ['minutes', 6e4],
  ['seconds', 1e3],
];

let cells = null;      // { days: <span>, hours: <span>, ... }
let target = null;
let frame = 0;
let peekTimer = 0;
let announced = -1;    // last minute pushed to the screen-reader line

const cfg = () => CONTENT.reveal ?? {};

/* ═══════════════════════════════════════════════════════════
   Build
   ═══════════════════════════════════════════════════════════ */
export function buildCountdown() {
  if (cells) return;
  target = revealAt();
  if (!target) return;

  const clock = $('#countdown-clock');
  cells = {};

  UNITS.forEach(([key], i) => {
    if (i) {
      const sep = document.createElement('span');
      sep.className = 'clock__sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = ':';
      clock.append(sep);
    }

    const unit = document.createElement('div');
    unit.className = 'clock__unit';

    const value = document.createElement('span');
    value.className = 'clock__value';
    value.textContent = '00';

    const label = document.createElement('span');
    label.className = 'clock__label';
    label.textContent = cfg().labels?.[key] ?? key;

    unit.append(value, label);
    clock.append(unit);
    cells[key] = value;
  });

  $('#countdown-date').textContent = (cfg().dateLine ?? '')
    .replace('{date}', formatRevealDate())
    .replace('{time}', formatRevealTime());

  wirePeek();
  render();
}

/** Tapping the locked gift: it rattles, but it does not open. */
function wirePeek() {
  const box = $('#countdown-box');
  const peek = $('#countdown-peek');

  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); box.click(); }
  });

  box.addEventListener('click', () => {
    if (box.classList.contains('is-opening')) return;

    box.classList.remove('is-shaking');
    void box.offsetWidth;                 // restart the animation on every tap
    box.classList.add('is-shaking');
    box.addEventListener('animationend', () => box.classList.remove('is-shaking'), { once: true });

    peek.textContent = cfg().peek ?? '';
    peek.classList.add('is-shown');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => peek.classList.remove('is-shown'), 2600);
  });
}

/* ═══════════════════════════════════════════════════════════
   Tick
   ═══════════════════════════════════════════════════════════ */
/** Paint the clock. Returns the milliseconds still to go. */
function render() {
  if (!cells || !target) return 0;

  let left = Math.max(0, target.getTime() - nowMs());
  const total = left;

  for (const [key, size] of UNITS) {
    const value = Math.floor(left / size);
    left -= value * size;

    const el = cells[key];
    const text = String(value).padStart(2, '0');
    if (el.textContent === text) continue;

    el.textContent = text;
    // Cleared on animationend rather than restarted by a forced reflow -
    // reading offsetWidth four times a second stalls the whole frame.
    if (!el.classList.contains('is-ticking')) {
      el.classList.add('is-ticking');
      el.addEventListener('animationend', () => el.classList.remove('is-ticking'), { once: true });
    }
  }

  // A spoken version, refreshed once a minute - a screen reader should not
  // have to sit through every passing second.
  const minutes = Math.ceil(total / 6e4);
  if (minutes !== announced) {
    announced = minutes;
    const d = Math.floor(total / 864e5);
    const h = Math.floor(total / 36e5) % 24;
    const m = Math.floor(total / 6e4) % 60;
    $('#countdown-sr').textContent =
      `${d} days, ${h} hours and ${m} minutes until this page opens.`;
  }

  return total;
}

/**
 * Start ticking. `onUnlock` fires once, the moment the wait is over.
 * Pass null to hold the scene open at zero instead (the ?locked=1 preview).
 */
export function startCountdown(onUnlock) {
  if (!target) { onUnlock?.(); return; }
  let fired = false;

  /* Driven by the frame clock, not by a timer.
     setTimeout gets clamped, and any callback that lands even slightly late
     makes the clock swallow a whole second - 45, 44, 43, 41. A frame always
     carries the true remaining time, so a slow frame costs a late paint
     rather than a missing number. It also parks itself while the tab is in
     the background and catches up on the first frame back. */
  const step = () => {
    frame = requestAnimationFrame(step);
    if (fired) return;

    if (render() > 0) return;
    if (!onUnlock) return;              // ?locked=1 preview: hold at zero

    fired = true;
    stopCountdown();
    $('#countdown-lead').textContent = cfg().openingNow ?? '';
    $('#countdown-box').classList.add('is-opening');
    onUnlock();
  };

  step();
}

export function stopCountdown() {
  cancelAnimationFrame(frame);
  frame = 0;
}
