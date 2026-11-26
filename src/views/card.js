// CreativeCard: one card for showing a creative to a brand, on the board and anywhere
// else a brand browses talent. Evidence for each choice is in docs/dev/creative-card.md.
//
//   media    swipeable photos with dots under them (Airbnb wishlist and search cards),
//            plus a black showreel tile with a play button when the creative has a
//            video link (TikTok and Behance thumbnails mark video with a play icon)
//   on top   day rate on a small black pill, heart top right (PR 27, DESIGN_RULES 4.4)
//   below    name with the rating or trust line on the right (Airbnb), then role and city
//   action   "Add to shoot" for brands only, leading to the Shoot Roster. Talent never see it and can't apply.
//
// The card only shows a star rating when the data has one (t.rating and t.reviews).
// Embr has no reviews yet, so today the right of the name shows "Rebooked by N brands"
// when that is true, and nothing otherwise. No made-up numbers.
import { S } from '../state.js';
import { photoUrl } from '../api.js';
import { esc, pounds, plural, rolesOf, rolesTxt } from '../ui.js';
import './roster.js';
import { ICON } from '../icons.js';

const MAX_PHOTOS = 5;
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.7l6.2-.9z" fill="currentColor"/></svg>';

// where a video link lives, for the showreel tile ("Vimeo", "TikTok"); unknown hosts say "Video"
const HOSTS = [['youtu', 'YouTube'], ['vimeo', 'Vimeo'], ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['drive.google', 'Google Drive']];
export const videoHost = (url) => {
  let h = '';
  try { h = new URL(url).hostname; } catch { return 'Video'; }
  return (HOSTS.find(([k]) => h.includes(k)) || [, 'Video'])[1];
};

// photos first, in profile order, then the showreel tile
export function mediaOf(t) {
  const photos = (t.photos?.length ? t.photos : t.photo ? [t.photo] : []).slice(0, MAX_PHOTOS);
  const m = photos.map((p) => ({ kind: 'photo', src: photoUrl(p) }));
  if (t.reel?.url) m.push({ kind: 'video', title: t.reel.title || (t.reel.role === 'Actor' ? 'Showreel' : 'Video'), host: videoHost(t.reel.url) });
  return m;
}

function slide(m, t, i, n) {
  const label = `${i + 1} of ${n}`;
  if (m.kind === 'video') {
    return `<div class="cc-slide cc-video" aria-label="${label}, ${esc(m.title)} on ${esc(m.host)}"><span class="cc-play">${PLAY}</span><span class="cc-vt">${esc(m.title)}</span><span class="cc-vh">${esc(m.host)}</span></div>`;
  }
  return `<div class="cc-slide" aria-label="${label}, photo"><img src="${esc(m.src)}" alt="" loading="${i ? 'lazy' : 'eager'}" decoding="async" draggable="false"></div>`;
}

function ratingTxt(t) {
  if (t.reviews > 0 && t.rating) return `<span class="cc-rating" aria-label="Rated ${esc(t.rating)} from ${plural(t.reviews, 'review')}">${STAR}${Number(t.rating).toFixed(1)}<span class="cc-n">(${esc(t.reviews)})</span></span>`;
  if (t.rebooked_by) return `<span class="cc-trust">Rebooked by ${plural(t.rebooked_by, 'brand')}</span>`;
  return '';
}

// The whole card opens the profile (Airbnb); the name is the one keyboard stop for it.
// opts.save: show the heart (brands only). opts.cta: show "Add to shoot" (brands only).
export function creativeCard(t, { save = true, cta = true } = {}) {
  const brand = S.me?.role === 'brand';
  const media = mediaOf(t);
  const rs = rolesOf(t);
  const hasVideo = media.some((m) => m.kind === 'video');
  const place = [t.city, rs.includes('Model') && t.height ? t.height : ''].filter(Boolean).join(' · ');
  const what = `${t.name}, ${rs.join(', ')}, ${t.city}${t.day_rate ? ', ' + pounds(t.day_rate) + ' a day' : ''}`;
  return `<article class="cc" data-a="talent" data-id="${t.id}">
    <div class="cc-frame">
      <div class="cc-media">${media.length
        ? media.map((m, i) => slide(m, t, i, media.length)).join('')
        : `<div class="cc-slide cc-empty"><span class="tname">${esc(t.name).replace(' ', '<br>')}</span></div>`}</div>
      ${hasVideo ? `<span class="cc-badge" aria-hidden="true">${PLAY}</span>` : ''}
      ${t.day_rate ? `<span class="cc-rate">${pounds(t.day_rate)} a day</span>` : ''}
      ${media.length > 1 ? `<span class="cc-dots" aria-hidden="true">${media.map((m, i) => `<i class="${i ? '' : 'on'}${m.kind === 'video' ? ' v' : ''}"></i>`).join('')}</span>` : ''}
      ${save && brand ? `<button class="save" data-a="save" data-id="${t.id}" aria-pressed="${!!t.saved}" aria-label="${t.saved ? 'Remove from shortlist' : 'Save to shortlist'}">${ICON.heart}</button>` : ''}
    </div>
    <div class="cc-body">
      <div class="cc-top"><button type="button" class="cc-nm" data-a="talent" data-id="${t.id}" aria-label="${esc(what)}">${esc(t.name)}${t.verified ? ICON.tick : ''}</button>${ratingTxt(t)}</div>
      <div class="cc-role">${esc(rolesTxt(t))}</div>
      <div class="cc-meta">${esc(place)}</div>
    </div>
    ${cta && brand ? `<button type="button" class="btn sm full cc-add" data-a="add-shoot" data-id="${t.id}" data-name="${esc(t.name)}">${ICON.plus}Add to shoot</button>` : ''}
  </article>`;
}

// dots follow the swipe; scroll events don't bubble, so listen on capture
if (typeof document !== 'undefined') {
  let raf = 0;
  document.addEventListener('scroll', (e) => {
    const m = e.target;
    if (!m.classList?.contains('cc-media')) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(m.scrollLeft / m.clientWidth);
      m.parentElement.querySelectorAll('.cc-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    });
  }, true);
}

// "Add to shoot" leads to the Shoot Roster: the sheet and the roster live in src/views/roster.js.
