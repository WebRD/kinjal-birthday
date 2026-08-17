/* ============================================================
   SCENE 6 · The Letter - wax seal, envelope opens, letter unfolds
   ============================================================ */

import { CONTENT } from '../content.js';
import { $, wait, paragraphs, prefersReducedMotion } from '../util.js';
import { confetti } from '../effects.js';

let built = false;
let opened = false;

export function buildLetter() {
  if (built) return;
  built = true;

  const body = $('#letter-body');
  body.replaceChildren(paragraphs(CONTENT.letter.body));
  $('#letter-sign').textContent = CONTENT.letter.signature;

  const seal = $('#envelope-seal');
  if (CONTENT.letter.sealInitials) seal.textContent = CONTENT.letter.sealInitials;

  const env = $('#envelope');
  env.addEventListener('click', openLetter);
  env.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLetter();
    }
  });
}

async function openLetter() {
  if (opened) return;
  opened = true;

  const env = $('#envelope');
  env.classList.add('is-open');
  env.setAttribute('aria-expanded', 'true');
  env.style.cursor = 'default';

  confetti({ y: .5, count: 34, power: 6, colors: ['#c9184a', '#ff8fab', '#f5c26b'] });

  await wait(prefersReducedMotion() ? 150 : 1000);

  // Hand the stage over from the little envelope to the readable letter.
  env.style.transition = 'opacity 500ms var(--ease), transform 500ms var(--ease)';
  env.style.opacity = '0';
  env.style.transform = 'translateY(-14px) scale(.94)';
  $('#letter-prompt').textContent = '';

  await wait(prefersReducedMotion() ? 60 : 460);

  env.classList.add('is-hidden');
  $('#letter-paper').classList.remove('is-hidden');
  $('#btn-letter-next').classList.remove('is-hidden');

  $('.scene--letter .scene__inner').scrollTo({ top: 0, behavior: 'smooth' });
}

/** Reset so Replay shows a sealed envelope again. */
export function resetLetter() {
  opened = false;
  const env = $('#envelope');
  if (!env) return;

  env.classList.remove('is-open', 'is-hidden');
  env.removeAttribute('style');
  env.setAttribute('aria-expanded', 'false');
  $('#letter-prompt').textContent = CONTENT.letter.prompt;
  $('#letter-paper').classList.add('is-hidden');
  $('#btn-letter-next').classList.add('is-hidden');
}
