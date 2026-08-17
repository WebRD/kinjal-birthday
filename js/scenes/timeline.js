/* ============================================================
   SCENE 3 . Our Story
   A chapter per folder. Chapters with several photos become a
   tappable polaroid stack so every picture gets seen.
   ============================================================ */

import { CONTENT } from '../content.js';
import { $, $$, placeholder, prefersReducedMotion } from '../util.js';

let built = false;

/** Full path for a photo inside a chapter folder. */
const photoPath = (folder, file) => CONTENT.photoDir + (folder ? folder + '/' : '') + file;

/**
 * Which photos a chapter shows. Normally everything in its folder, straight
 * from the manifest photos.py generates, so filenames never have to be typed
 * into content.js. A milestone can still pin an explicit `photos` list.
 */
function photosFor(milestone) {
  if (milestone.photos?.length) return milestone.photos;
  return CONTENT._photos?.[milestone.folder] ?? [];
}

export function buildTimeline() {
  if (built) return;
  built = true;

  const list = $('#timeline');
  const { milestones, stackHint } = CONTENT.story;

  milestones.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'tl-item';

    const node = document.createElement('span');
    node.className = 'tl-item__node';
    node.textContent = String(i + 1);

    const date = document.createElement('p');
    date.className = 'tl-item__date';
    date.textContent = m.date ?? '';

    const title = document.createElement('h3');
    title.className = 'tl-item__title';
    title.textContent = m.title ?? '';

    const text = document.createElement('p');
    text.className = 'tl-item__text';
    text.textContent = m.text ?? '';

    li.append(node, date, title, text);

    const photos = photosFor(m);
    if (photos.length) li.append(buildStack(m, photos, stackHint));

    list.append(li);
  });

  observeReveals();
}

/* ── The polaroid ─────────────────────────────────────────── */
function buildStack(milestone, photos, stackHint) {
  const multi = photos.length > 1;

  const fig = document.createElement('figure');
  fig.className = 'polaroid' + (multi ? ' polaroid--stack' : '');
  fig.style.setProperty('--tilt', `${(Math.random() * 4 - 2).toFixed(2)}deg`);
  fig.tabIndex = 0;
  fig.setAttribute('role', multi ? 'button' : 'img');
  fig.setAttribute('aria-label',
    multi ? `${milestone.title}, ${photos.length} photos. Activate to see the next one.`
          : milestone.title ?? '');

  const well = document.createElement('div');
  well.className = 'polaroid__img';

  // Only the first photo loads up front. The rest are fetched as she taps
  // through, so a nine-photo chapter costs one image until she asks for more.
  photos.forEach((file, idx) => {
    const img = new Image();
    img.className = 'polaroid__photo' + (idx === 0 ? ' is-shown' : '');
    img.alt = '';
    img.decoding = 'async';
    img.dataset.src = photoPath(milestone.folder, file);
    if (idx === 0) img.src = img.dataset.src;
    img.addEventListener('error', () => img.replaceWith(placeholder(file)), { once: true });
    well.append(img);
  });

  const cap = document.createElement('figcaption');
  cap.className = 'polaroid__caption';
  cap.textContent = milestone.caption ?? '';

  // The visible white print. Kept as its own layer so the stack sheets behind
  // it (drawn by CSS pseudo-elements) never paint over the photo.
  const paper = document.createElement('div');
  paper.className = 'polaroid__paper';
  paper.append(well, cap);
  fig.append(paper);

  if (multi) {
    const counter = document.createElement('span');
    counter.className = 'polaroid__counter';
    counter.textContent = `1 / ${photos.length}`;
    paper.append(counter);

    const hint = document.createElement('span');
    hint.className = 'polaroid__hint';
    hint.textContent = stackHint ?? 'tap for more';
    fig.append(hint);

    let index = 0;
    const advance = () => {
      const frames = $$('.polaroid__photo', well);
      frames[index]?.classList.remove('is-shown');
      index = (index + 1) % frames.length;
      const cur = frames[index];
      if (cur && !cur.src && cur.dataset.src) cur.src = cur.dataset.src;
      cur?.classList.add('is-shown');

      // Warm the following one so the next tap is instant.
      const nxt = frames[(index + 1) % frames.length];
      if (nxt && !nxt.src && nxt.dataset.src) nxt.src = nxt.dataset.src;

      counter.textContent = `${index + 1} / ${frames.length}`;
      fig.classList.add('is-turning');
      setTimeout(() => fig.classList.remove('is-turning'), 380);
      hint.classList.add('is-used');
    };

    fig.addEventListener('click', advance);
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
    });
  } else {
    // Single photo: tapping just straightens it, since touch has no hover.
    fig.addEventListener('click', () => fig.classList.toggle('is-poked'));
  }

  return fig;
}

/* ── Scroll reveals ───────────────────────────────────────── */
function observeReveals() {
  const items = $$('.tl-item');
  const root = $('.scene--story .scene__inner');

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      io.unobserve(entry.target);
    });
  }, { root, rootMargin: '0px 0px -12% 0px', threshold: .15 });

  items.forEach(el => io.observe(el));

  const cue = $('.scroll-cue');
  root.addEventListener('scroll', () => {
    const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 80;
    cue?.classList.toggle('is-done', atEnd);
  }, { passive: true });
}

/** Called each time the scene is entered. */
export function refreshTimeline() {
  const root = $('.scene--story .scene__inner');
  if (!root) return;
  root.scrollTop = 0;
  $('.scroll-cue')?.classList.remove('is-done');
  requestAnimationFrame(() => $('.tl-item')?.classList.add('is-revealed'));
}

/** Every photo in the story, as full paths. Used by the finale photo wall. */
export function allStoryPhotos() {
  return CONTENT.story.milestones.flatMap(m =>
    photosFor(m).map(file => photoPath(m.folder, file)));
}
