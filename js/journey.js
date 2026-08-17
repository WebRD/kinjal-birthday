/* ============================================================
   JOURNEY · scene manager - transitions, progress trail, music,
             and the wiring for every scene.
   ============================================================ */

import { CONTENT } from './content.js';
import { $, $$, wait, applyContent, photoEl, preloadPhotos, prefersReducedMotion } from './util.js';
import { startBokeh, initFx, confetti, confettiRain, typewriter, spawnBalloons } from './effects.js';
import { revealState, formatRevealDate } from './reveal.js';

import { buildCountdown, startCountdown } from './scenes/countdown.js';
import { buildTimeline, refreshTimeline } from './scenes/timeline.js';
import { buildReasons, wireReasonsSkip } from './scenes/reasons.js';
import { buildCake, resetCake, stopMic } from './scenes/cake.js';
import { buildLetter, resetLetter } from './scenes/letter.js';
import { buildFinale, enterFinale, leaveFinale, wireEasterEgg } from './scenes/finale.js';

/* Order of the journey. 'preloader' is excluded from the progress trail. */
const ORDER = ['preloader', 'landing', 'wish', 'story', 'reasons', 'cake', 'letter', 'finale'];
const TRAILED = ORDER.slice(1);

/* Doorways, not chapters: they sit outside ORDER so next/back and the trail
   can never wander into them. */
const GATES = ['preloader', 'countdown'];

let current = 'preloader';
let furthest = 0;          // highest trail index reached - gates backward nav
let transitioning = false;

const sceneEl = name => $(`.scene[data-scene="${name}"]`);

/* ═══════════════════════════════════════════════════════════
   Scene transitions
   ═══════════════════════════════════════════════════════════ */
async function goTo(name, { instant = false } = {}) {
  if (transitioning || name === current || !sceneEl(name)) return;
  transitioning = true;

  const from = sceneEl(current);
  const to = sceneEl(name);

  onLeave(current);

  // Mount the incoming scene first so its layout settles before it fades in.
  to.classList.add('is-mounted');
  await nextFrame();

  if (!instant && !prefersReducedMotion()) {
    from.classList.add('is-leaving');
    from.classList.remove('is-active');
    await wait(320);
  } else {
    from.classList.remove('is-active');
  }

  from.classList.remove('is-mounted', 'is-leaving');

  current = name;
  onBeforeEnter(name);
  to.classList.add('is-active');

  updateTrail();
  syncUrl(name);

  await wait(instant ? 0 : 260);
  transitioning = false;

  onEnter(name);
  preloadNext(name);
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Keep ?scene= in sync for reloads, leaving any other params (?now=, ?open=)
    untouched. Throws on file:// - harmless either way. */
function syncUrl(name) {
  try {
    const params = new URLSearchParams(location.search);
    if (name === 'landing' || GATES.includes(name)) params.delete('scene');
    else params.set('scene', name);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  } catch { /* non-http origin */ }
}

/** First photo of a chapter, as a full path (or null if the folder is empty). */
function leadPhoto(milestone) {
  const file = milestone.photos?.[0] ?? CONTENT._photos?.[milestone.folder]?.[0];
  return file ? CONTENT.photoDir + milestone.folder + '/' + file : null;
}

function next() {
  const i = ORDER.indexOf(current);
  if (i > -1 && i < ORDER.length - 1) goTo(ORDER[i + 1]);
}

/* ═══════════════════════════════════════════════════════════
   Per-scene lifecycle
   ═══════════════════════════════════════════════════════════ */
function onBeforeEnter(name) {
  // Build lazily: nothing but the landing scene exists until it's needed.
  if (name === 'story')   buildTimeline();
  if (name === 'reasons') buildReasons();
  if (name === 'cake')    buildCake();
  if (name === 'letter')  buildLetter();
  if (name === 'finale')  buildFinale();

  const idx = TRAILED.indexOf(name);
  if (idx > furthest) furthest = idx;
}

function onEnter(name) {
  switch (name) {
    case 'countdown':
    case 'landing':
      $('.trail').classList.remove('is-visible');
      break;

    case 'wish':
      typewriter($('#wish-typewriter'), CONTENT.wish.typed);
      break;

    case 'story':
      refreshTimeline();
      break;

    case 'reasons':
    case 'letter':
      $(`.scene--${name} .scene__inner`).scrollTop = 0;
      break;

    case 'finale':
      $('.scene--finale .scene__inner').scrollTop = 0;
      enterFinale();
      break;
  }

  if (name !== 'landing' && !GATES.includes(name)) $('.trail').classList.add('is-visible');
}

function onLeave(name) {
  if (name === 'finale') leaveFinale();
  if (name === 'cake') stopMic();
}

/** Warm the next scene's photos while she's reading the current one. */
function preloadNext(name) {
  const upcoming = ORDER[ORDER.indexOf(name) + 1];
  if (upcoming !== 'story') return;
  // Just the lead photo of the first few chapters; the rest load on demand.
  preloadPhotos(CONTENT.story.milestones.slice(0, 3).map(leadPhoto));
}

/* ═══════════════════════════════════════════════════════════
   Progress trail
   ═══════════════════════════════════════════════════════════ */
function buildTrail() {
  const trail = $('#trail');
  TRAILED.forEach((name, i) => {
    const dot = document.createElement('button');
    dot.className = 'trail__dot';
    dot.type = 'button';
    dot.dataset.target = name;
    dot.setAttribute('aria-label', `Go to step ${i + 1}`);
    dot.addEventListener('click', () => {
      if (i <= furthest) goTo(name);
    });
    trail.append(dot);
  });
}

function updateTrail() {
  const currentIdx = TRAILED.indexOf(current);
  $$('.trail__dot').forEach((dot, i) => {
    dot.classList.toggle('is-current', i === currentIdx);
    dot.classList.toggle('is-visited', i < currentIdx);
    // Only places she's already been are clickable - no spoiling what's ahead.
    dot.disabled = i > furthest;
    dot.setAttribute('aria-current', i === currentIdx ? 'step' : 'false');
  });
}

/* ═══════════════════════════════════════════════════════════
   Music (only if a track is configured in content.js)
   ═══════════════════════════════════════════════════════════ */
function setupMusic() {
  if (!CONTENT.music) return;

  const audio = $('#music');
  const btn = $('#music-toggle');
  const credit = $('#music-credit');

  audio.src = `assets/music/${CONTENT.music}`;
  audio.volume = 0;
  btn.classList.remove('is-hidden');

  if (CONTENT.musicCredit) {
    credit.textContent = CONTENT.musicCredit;
    credit.classList.remove('is-hidden');
  }

  let playing = false;
  let creditTimer = 0;

  btn.addEventListener('click', async () => {
    if (playing) {
      fadeTo(audio, 0, 600, () => audio.pause());
      playing = false;
    } else {
      try {
        await audio.play();
        playing = true;
        fadeTo(audio, 0.4, 2200);
      } catch { /* browser blocked it, she can tap again */ }
    }
    btn.setAttribute('aria-pressed', String(playing));

    // Show the track name briefly, then get out of the way. Left on screen it
    // sits on top of the story text.
    clearTimeout(creditTimer);
    credit.classList.toggle('is-shown', playing);
    if (playing) creditTimer = setTimeout(() => credit.classList.remove('is-shown'), 4200);
  });
}

function fadeTo(audio, target, ms, done) {
  const start = audio.volume;
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min(1, (now - t0) / ms);
    audio.volume = Math.max(0, Math.min(1, start + (target - start) * p));
    if (p < 1) requestAnimationFrame(step);
    else done?.();
  })(t0);
}

/* ═══════════════════════════════════════════════════════════
   Scene-specific wiring
   ═══════════════════════════════════════════════════════════ */
function wireLanding() {
  spawnBalloons($('.balloons'));

  const box = $('#giftbox');
  const btn = $('#btn-open-gift');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    box.classList.add('is-opening');
    confetti({ y: .62, count: 150, power: 13 });

    await wait(prefersReducedMotion() ? 120 : 720);
    goTo('wish');

    // Re-arm so Replay works.
    await wait(900);
    box.classList.remove('is-opening');
    btn.disabled = false;
  });

  // A little life if she hovers without clicking.
  box.addEventListener('mouseenter', () => {
    if (box.classList.contains('is-opening')) return;
    box.classList.add('is-shaking');
    box.addEventListener('animationend', () => box.classList.remove('is-shaking'), { once: true });
  });
}

function wireReplay() {
  $('#btn-replay').addEventListener('click', async () => {
    leaveFinale();
    resetCake();
    resetLetter();
    furthest = 0;
    await goTo('landing');
  });
}

/* ═══════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════ */
async function boot() {
  applyContent();
  document.title = `Happy Birthday, ${CONTENT.name} ♥`;

  startBokeh($('#bokeh-canvas'));
  initFx($('#fx-canvas'));

  // Hero photo
  $('[data-photo="hero"]').append(photoEl(CONTENT.wish.photo, `${CONTENT.name} and me`));

  buildTrail();
  setupMusic();
  wireLanding();
  wireReplay();
  wireEasterEgg();
  wireReasonsSkip(() => goTo('cake'));

  // Every "next" button in the markup just advances the journey.
  $$('[data-next]').forEach(btn => btn.addEventListener('click', next));

  // Keyboard: arrows / space to move through the journey.
  document.addEventListener('keydown', (e) => {
    if (!$('#egg-modal').hidden) return;
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') {
      const i = ORDER.indexOf(current);
      if (i > 1) goTo(ORDER[i - 1]);
    }
  });

  // ── Preload, then start ──
  const fill = $('#preloader-fill');
  const setProgress = p => { fill.setAttribute('y', String(90 - 90 * p)); };

  const firstPhotos = [
    CONTENT.wish.photo && CONTENT.photoDir + CONTENT.wish.photo,
    ...CONTENT.story.milestones.slice(0, 2).map(leadPhoto),
  ].filter(Boolean);
  const loading = preloadPhotos(firstPhotos, setProgress);
  // Never let a slow/missing asset hold her hostage on the loading screen.
  await Promise.race([loading, wait(3500)]);
  setProgress(1);
  await wait(500);

  // ── Is it her birthday yet? ──
  const gate = revealState();
  if (gate.locked) {
    buildCountdown();
    await goTo('countdown');
    startCountdown(gate.preview ? null : openTheDoor);
    return;                     // nothing past this point is hers yet
  }
  if (gate.daysSince > 0) showAfterNote(gate.daysSince);

  // ?scene=cake jumps straight to a scene - handy while you're editing.
  const requested = new URLSearchParams(location.search).get('scene');
  const target = ORDER.includes(requested) && requested !== 'preloader' ? requested : 'landing';
  if (target !== 'landing') furthest = TRAILED.indexOf(target);

  await goTo(target);
}

/** Midnight, while she is watching. The countdown hands over to the journey. */
async function openTheDoor() {
  confettiRain(prefersReducedMotion() ? 900 : 3200);
  await wait(prefersReducedMotion() ? 300 : 1400);
  await goTo('landing');
}

/** A quiet line on the landing when she comes back after the day itself. */
function showAfterNote(days) {
  const cfg = CONTENT.reveal ?? {};
  // Counting days stops meaning anything after a couple of months.
  const template = days > 60 ? cfg.afterNoteLater
                 : days === 1 ? (cfg.afterNoteOne ?? cfg.afterNote)
                 : cfg.afterNote;
  if (!template) return;

  const note = $('#landing-note');
  note.textContent = template
    .replace('{days}', String(days))
    .replace('{date}', formatRevealDate());
  note.classList.remove('is-hidden');
}

boot();
