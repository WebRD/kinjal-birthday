/* ============================================================
   REVEAL · the date gate.

   Everything here answers one question: is it her birthday yet?

   The moment is pinned to a real timezone (IST by default), not to
   the viewer's clock - so the page opens at the same instant for her
   whether her phone is set to Ahmedabad, London, or nothing at all.

   Set the date in content.js -> reveal.

   While editing, three query params help:
     ?open=1     force the journey open, ignore the date
     ?locked=1   force the countdown, even after the date
     ?now=2026-09-11T23:59:45   pretend it is this moment
                 (no timezone in the string = read as reveal.timezone)
   ============================================================ */

import { CONTENT } from './content.js';

const params = new URLSearchParams(location.search);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const pad = n => String(n).padStart(2, '0');
const cfg = () => CONTENT.reveal ?? {};

/* ═══════════════════════════════════════════════════════════
   Timezone
   ═══════════════════════════════════════════════════════════ */
/** '+05:30' -> { suffix: '+05:30', minutes: 330 }. Falls back to IST. */
function zone() {
  const m = /^([+-])(\d{1,2}):?(\d{2})?$/.exec(String(cfg().timezone ?? '').trim());
  if (!m) return { suffix: '+05:30', minutes: 330, label: 'IST' };
  const minutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  return { suffix: `${m[1]}${pad(Number(m[2]))}:${pad(Number(m[3] ?? 0))}`, minutes };
}

/* ═══════════════════════════════════════════════════════════
   The target moment
   ═══════════════════════════════════════════════════════════ */
/** Split '12-09-2026' / '12 . 09 . 2026' / '2026-09-12' into [y, m, d]. */
function dateParts(raw) {
  const n = String(raw).split(/\D+/).filter(Boolean).map(Number);
  if (n.length < 3) return null;
  // A first number over 31 can only be a year, so that form is YYYY-MM-DD.
  return n[0] > 31 ? [n[0], n[1], n[2]] : [n[2], n[1], n[0]];
}

/**
 * The exact instant the page unlocks, as a Date.
 * Returns null if no date is set or it can't be read - the gate then stays
 * open, because a typo should never lock her out of her own present.
 */
export function revealAt() {
  const { date, time = '00:00' } = cfg();
  if (!date) return null;

  const ymd = dateParts(date);
  if (!ymd) return null;

  const [y, mo, d] = ymd;
  const [h = 0, mi = 0] = String(time).split(/\D+/).filter(Boolean).map(Number);

  const at = new Date(
    `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${zone().suffix}`
  );
  return Number.isNaN(at.getTime()) ? null : at;
}

/* ═══════════════════════════════════════════════════════════
   The clock
   ═══════════════════════════════════════════════════════════ */
/** Offset between the real clock and the simulated one (?now=...). */
const simulated = (() => {
  const raw = params.get('now');
  if (!raw) return 0;
  // Bare timestamps are read in the reveal timezone, not the device's.
  const stamped = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + zone().suffix;
  const at = new Date(stamped).getTime();
  return Number.isNaN(at) ? 0 : at - Date.now();
})();

/** Current time in ms. Honours ?now= while you're editing. */
export const nowMs = () => Date.now() + simulated;

/** Whole calendar days from `a` to `b`, counted in the reveal timezone. */
function daysApart(a, b) {
  const shift = zone().minutes * 60000;
  const day = ms => Math.floor((ms + shift) / 864e5);
  return day(b) - day(a);
}

/* ═══════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════ */
/**
 * Where we are relative to the big day.
 *   locked     - still waiting; show the countdown, nothing else
 *   msLeft     - milliseconds until it opens (0 once it has)
 *   daysSince  - whole days since the birthday (0 on the day itself)
 *   preview    - ?locked=1, so the countdown must not open by itself
 */
export function revealState() {
  const target = revealAt();
  const open = { locked: false, preview: false, target, msLeft: 0, daysSince: 0 };

  if (params.get('open') === '1') return open;
  if (!target || cfg().on === false) return open;

  const msLeft = target.getTime() - nowMs();
  const preview = params.get('locked') === '1';

  if (msLeft <= 0 && !preview) {
    return { ...open, daysSince: Math.max(0, daysApart(target.getTime(), nowMs())) };
  }
  return { locked: true, preview, target, msLeft: Math.max(0, msLeft), daysSince: 0 };
}

/* ═══════════════════════════════════════════════════════════
   Display helpers - built from the configured parts, so they read
   the same everywhere regardless of the device's locale/timezone.
   ═══════════════════════════════════════════════════════════ */
/** '12 September 2026' */
export function formatRevealDate() {
  const ymd = dateParts(cfg().date ?? '');
  if (!ymd) return '';
  const [y, mo, d] = ymd;
  return `${d} ${MONTHS[mo - 1] ?? ''} ${y}`.replace(/\s+/g, ' ').trim();
}

/** '12:00 am' */
export function formatRevealTime() {
  const [h = 0, mi = 0] = String(cfg().time ?? '00:00').split(/\D+/).filter(Boolean).map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(mi)} ${suffix}`;
}
