/* ============================================================
   UTIL · small shared helpers
   ============================================================ */

import { CONTENT } from './content.js';

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const rand = (min, max) => Math.random() * (max - min) + min;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const wait = ms => new Promise(r => setTimeout(r, ms));

/**
 * Build a photo element for `filename`.
 * If the file is missing (or no filename given), a styled placeholder is shown
 * instead - so the page always looks intentional while photos are still being
 * collected.
 */
export function photoEl(filename, alt = '') {
  if (!filename) return placeholder('photo');
  return photoElFromSrc(CONTENT.photoDir + filename, alt, filename);
}

/** Same, but for an already-resolved path (chapter folders, mosaic, ...). */
export function photoElFromSrc(src, alt = '', label = src) {
  const img = new Image();
  img.className = 'photo';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = alt;
  img.src = src;

  // Swap in a placeholder if the file isn't there.
  img.addEventListener('error', () => {
    img.replaceWith(placeholder(label.split('/').pop()));
  }, { once: true });

  return img;
}

export function placeholder(label) {
  const div = document.createElement('div');
  div.className = 'photo-placeholder';
  div.setAttribute('aria-hidden', 'true');
  const span = document.createElement('span');
  span.textContent = label;
  div.append(span);
  return div;
}

/** Preload a list of full photo paths; resolves when all settle (never rejects). */
export function preloadPhotos(paths, onProgress) {
  const list = paths.filter(Boolean);
  if (!list.length) return Promise.resolve();

  let done = 0;
  return Promise.all(list.map(src => new Promise(resolve => {
    const img = new Image();
    const finish = () => {
      done++;
      onProgress?.(done / list.length);
      resolve();
    };
    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });
    img.src = src;
  })));
}

/** Resolve a dotted path like 'story.title' against an object. */
export function deepGet(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Fill every [data-content="path"] element in `root` with the matching string
 * from CONTENT. Keeps all copy in content.js instead of the markup.
 */
export function applyContent(root = document) {
  $$('[data-content]', root).forEach(el => {
    const value = deepGet(CONTENT, el.dataset.content);
    if (typeof value === 'string') el.textContent = value;
  });
}

/** Split a block of text on blank lines into <p> elements. */
export function paragraphs(text) {
  const frag = document.createDocumentFragment();
  text.trim().split(/\n\s*\n/).forEach(chunk => {
    const p = document.createElement('p');
    p.textContent = chunk.trim();
    frag.append(p);
  });
  return frag;
}
