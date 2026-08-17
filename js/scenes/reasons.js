/* ============================================================
   SCENE 4 · Reasons I Love You - flip cards, unlock on completion
   ============================================================ */

import { CONTENT } from '../content.js';
import { $, prefersReducedMotion } from '../util.js';
import { confetti } from '../effects.js';

let built = false;
const found = new Set();

export function buildReasons() {
  if (built) return;
  built = true;

  const grid = $('#reasons-grid');
  const { list } = CONTENT.reasons;

  list.forEach((reason, i) => {
    const card = document.createElement('button');
    card.className = 'reason';
    card.type = 'button';
    card.setAttribute('aria-label', `Reason ${i + 1} of ${list.length} - tap to reveal`);

    const inner = document.createElement('div');
    inner.className = 'reason__inner';

    const front = document.createElement('div');
    front.className = 'reason__face reason__face--front';
    front.textContent = '♥';

    const back = document.createElement('div');
    back.className = 'reason__face reason__face--back';

    const num = document.createElement('span');
    num.className = 'reason__num';
    num.textContent = String(i + 1).padStart(2, '0');

    const text = document.createElement('p');
    text.className = 'reason__text';
    text.textContent = reason;

    back.append(num, text);
    inner.append(front, back);
    card.append(inner);

    card.addEventListener('click', () => reveal(card, i, reason));
    grid.append(card);
  });

  updateCounter();
}

function reveal(card, index, reason) {
  if (found.has(index)) return;
  found.add(index);

  card.classList.add('is-flipped');
  card.setAttribute('aria-label', reason);

  // A small puff of hearts from the card that was just turned over.
  const r = card.getBoundingClientRect();
  confetti({
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
    count: 14,
    power: 5,
    colors: ['#ff8fab', '#ffc2d1', '#f5c26b'],
  });

  updateCounter();

  if (found.size === CONTENT.reasons.list.length) unlock();
}

function updateCounter() {
  const total = CONTENT.reasons.list.length;
  $('#reasons-counter').textContent = CONTENT.reasons.counterTemplate
    .replace('{found}', found.size)
    .replace('{total}', total);
}

function unlock() {
  const btn = $('#btn-reasons-next');
  if (!btn.disabled) return;

  btn.disabled = false;
  btn.classList.remove('is-locked');
  if (!prefersReducedMotion()) {
    btn.classList.add('is-unlocking');
    btn.addEventListener('animationend', () => btn.classList.remove('is-unlocking'), { once: true });
  }
  $('#btn-reasons-skip')?.classList.add('is-hidden');
  confetti({ y: .6, count: 70, power: 11 });
  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** The skip link - she should never be stuck behind a puzzle on her birthday. */
export function wireReasonsSkip(onSkip) {
  $('#btn-reasons-skip').addEventListener('click', onSkip);
}
