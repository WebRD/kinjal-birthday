/* ============================================================
   SCENE 7 · Finale - photo mosaic, fireworks, easter egg
   ============================================================ */

import { CONTENT } from '../content.js';
import { $, photoElFromSrc, rand, prefersReducedMotion } from '../util.js';
import { confettiRain, fireworkShow } from '../effects.js';
import { allStoryPhotos } from './timeline.js';

let built = false;
let stopShow = null;

/**
 * Photos for the wall. By default every photo from every chapter, shuffled
 * deterministically so the wall mixes chapters instead of showing them in
 * seven obvious blocks.
 */
function mosaicPhotos() {
  const configured = CONTENT.finale.mosaic ?? [];
  const list = configured.length
    ? configured.map(f => CONTENT.photoDir + f)
    : allStoryPhotos();

  // Fixed-seed interleave: no Math.random, so the wall looks the same each visit.
  const out = [];
  const step = 3;
  for (let offset = 0; offset < step; offset++)
    for (let i = offset; i < list.length; i += step) out.push(list[i]);
  return out;
}

export function buildFinale() {
  if (built) return;
  built = true;

  $('#monogram').textContent = CONTENT.letter.sealInitials ?? '';

  const grid = $('#mosaic');
  const photos = mosaicPhotos();
  if (!photos.length) return;

  // Fill the whole wall, repeating the photo set as needed. Sized off the
  // LARGER viewport dimension in both directions so rotating the phone can't
  // leave a bald patch - the surplus is simply clipped by overflow:hidden.
  const tile = window.innerWidth >= 900 ? 110 : 84;
  const span = Math.max(window.innerWidth, window.innerHeight);
  const perSide = Math.ceil(span / tile) + 1;
  const tilesNeeded = Math.min(140, perSide * perSide);

  for (let i = 0; i < tilesNeeded; i++) {
    const tile = document.createElement('div');
    tile.className = 'mosaic__tile';
    // Stagger the assembly, but cap it so a big screen doesn't take 6s to fill.
    tile.style.animationDelay = `${Math.min(i * 22, 1800)}ms`;
    tile.style.setProperty('--spin', `${rand(-9, 9)}deg`);
    tile.append(photoElFromSrc(photos[i % photos.length]));
    grid.append(tile);
  }
}

export function enterFinale() {
  confettiRain(prefersReducedMotion() ? 1200 : 6000);
  stopShow?.();
  stopShow = fireworkShow(1000);
}

export function leaveFinale() {
  stopShow?.();
  stopShow = null;
}

/* ── Easter egg modal ─────────────────────────────────────── */
export function wireEasterEgg() {
  const modal = $('#egg-modal');
  const { title, subtitle, items } = CONTENT.easterEgg;

  $('#egg-title').textContent = title;
  $('#egg-sub').textContent = subtitle;
  $('#egg-list').replaceChildren(...items.map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));

  const open = () => {
    modal.hidden = false;
    $('.modal__close').focus();
  };
  const close = () => {
    modal.hidden = true;
    $('#easter-egg').focus();
  };

  $('#easter-egg').addEventListener('click', open);
  modal.querySelectorAll('[data-close-modal]').forEach(el =>
    el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
