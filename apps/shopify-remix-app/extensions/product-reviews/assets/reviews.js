// Each block initializes once. Review text uses textContent, never HTML.
function initializeReviews() {
document.querySelectorAll('[data-pr-root]:not([data-pr-ready])').forEach((root) => {
  root.dataset.prReady = 'true';
  const $ = (s) => root.querySelector(s);
  const { endpoint, productId } = root.dataset;
  const list = $('[data-pr-list]'), more = $('[data-pr-more]'), summary = $('[data-pr-summary]');
  const dialog = $('[data-pr-dialog]'), form = $('[data-pr-form]');
  const err = $('[data-pr-error]'), ok = $('[data-pr-ok]'), submit = $('[data-pr-submit]');
  let page = 0;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const stars = (r) => {
    const s = el('span', 'pr__stars-view', '★★★★★');
    s.style.setProperty('--pct', `${(r / 5) * 100}%`);
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', `${r} out of 5 stars`);
    return s;
  };

  function renderSummary({ count, average, distribution }) {
    summary.replaceChildren();
    summary.classList.toggle("pr__summary--empty", !count);
    if (!count) return summary.append(el('p', 'pr__muted', 'No reviews yet. Be the first to share your thoughts.'));
    const left = el('div', 'pr__score');
    left.append(el('div', 'pr__avg', average.toFixed(1)), stars(average), el('p', 'pr__muted', `${count} review${count > 1 ? 's' : ''}`));
    const bars = el('div', 'pr__bars');
    for (let i = 5; i >= 1; i--) {
      const row = el('div', 'pr__bar'), track = el('i'), fill = el('b');
      fill.style.width = `${(distribution[i - 1] / count) * 100}%`;
      track.append(fill);
      row.append(el('span', null, `${i} ★`), track, el('span', null, String(distribution[i - 1])));
      bars.append(row);
    }
    summary.append(left, bars);
  }

  function renderReview(r) {
    const li = el('li', 'pr__item');
    const date = new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const head = el('div', 'pr__review-head');
    const author = el('div', 'pr__author');
    const avatar = el('span', 'pr__avatar', r.name.slice(0, 1).toUpperCase());
    avatar.setAttribute('aria-hidden', 'true');
    author.append(avatar, el('span', null, r.name));
    head.append(author, stars(r.rating));
    li.append(head, el('h3', null, r.title), el('p', null, r.body), el('p', 'pr__meta', [date, r.variant].filter(Boolean).join(' · ')));
    if (r.media?.length) {
      const gallery = el('div', 'pr__media');
      r.media.forEach((file) => {
        if (!['image/webp', 'video/mp4'].includes(file.type)) return;
        const url = new URL(endpoint, location.origin);
        url.searchParams.set('reviewId', r.reviewId);
        url.searchParams.set('media', file.id);
        const asset = el(file.type === 'video/mp4' ? 'video' : 'img');
        asset.src = url.href;
        if (file.type === 'video/mp4') { asset.controls = true; asset.preload = 'none'; }
        else { asset.alt = 'Customer review photo'; asset.loading = 'lazy'; }
        gallery.append(asset);
      });
      li.append(gallery);
    }
    return li;
  }

  async function load() {
    more.disabled = true;
    more.textContent = 'Loading reviews…';
    list.setAttribute('aria-busy', 'true');
    const nextPage = page + 1;
    try {
      const res = await fetch(`${endpoint}?productId=${productId}&page=${nextPage}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (nextPage === 1) renderSummary(data.stats);
      list.append(...data.reviews.map(renderReview));
      more.hidden = !data.hasMore;
      more.textContent = 'Load more reviews';
      page = nextPage;
    } catch {
      if (page === 0) summary.replaceChildren(el('p', 'pr__muted', 'Reviews could not be loaded right now.'));
      more.hidden = false;
      more.textContent = 'Could not load reviews. Retry';
    }
    more.disabled = false;
    list.setAttribute('aria-busy', 'false');
  }

  more.addEventListener('click', load);
  $('[data-pr-open]').addEventListener('click', () => { ok.hidden = true; dialog.showModal(); });
  $('[data-pr-close]').addEventListener('click', () => dialog.close());

  const ratingText = $('[data-pr-rating-text]');
  const mediaInput = $('[data-pr-media]');
  const previews = $('[data-pr-previews]');
  let previewUrls = [];
  function clearPreviews() { previewUrls.forEach(URL.revokeObjectURL); previewUrls = []; previews?.replaceChildren(); }
  function mediaError(files) {
    if (files.length > 3 || files.reduce((sum, file) => sum + file.size, 0) > 12 * 1024 * 1024) return 'Choose up to 3 attachments, no more than 12 MB total.';
    for (const file of files) {
      const image = /\.(jpe?g|png|webp)$/i.test(file.name) && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const video = /\.(mp4|webm)$/i.test(file.name) && ['video/mp4', 'video/webm'].includes(file.type);
      if (!image && !video) return 'Use JPG, PNG, WebP, MP4 or WebM files only.';
      if (!file.size || file.size > (image ? 3 : 8) * 1024 * 1024) return image ? 'Each photo must be 3 MB or smaller.' : 'Each video must be 8 MB or smaller.';
    }
    return '';
  }
  mediaInput?.addEventListener('change', () => {
    clearPreviews();
    const files = [...mediaInput.files];
    const message = mediaError(files);
    err.hidden = !message;
    if (message) { err.textContent = message; mediaInput.value = ''; return; }
    files.forEach((file) => {
      const preview = el(file.type.startsWith('video/') ? 'video' : 'img');
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      preview.src = url;
      if (file.type.startsWith('video/')) { preview.controls = true; preview.preload = 'metadata'; }
      else preview.alt = 'Selected review photo';
      previews.append(preview);
    });
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'rating') ratingText.textContent = `${e.target.value} of 5`; });
  form.addEventListener('reset', () => { ratingText.textContent = ''; clearPreviews(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = ok.hidden = true;
    const fd = new FormData(form);
    const attachmentError = mediaError([...(mediaInput?.files || [])]);
    if (attachmentError) { err.textContent = attachmentError; err.hidden = false; return; }
    const fields = [...form.querySelectorAll('input:not([type=radio]),textarea')];
    const invalid = fields.filter((f) => !f.checkValidity());
    fields.forEach((f) => f.setAttribute('aria-invalid', String(invalid.includes(f))));
    if (!fd.get('rating') || invalid.length) {
      err.textContent = !fd.get('rating') ? 'Please choose a rating.' : 'Please complete all fields correctly.';
      err.hidden = false;
      return (invalid[0] || form.querySelector('input[name=rating]')).focus();
    }
    fd.set('productId', productId);
    fd.set('variantId', new URLSearchParams(location.search).get('variant') || root.dataset.variantId || '');
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    form.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      form.reset();
      ok.hidden = false;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
    submit.disabled = false;
    submit.textContent = 'Submit review';
    form.setAttribute('aria-busy', 'false');
  });

  load();
});
}
initializeReviews();
if (!window.productReviewsInitialized) {
  window.productReviewsInitialized = true;
  document.addEventListener('shopify:section:load', initializeReviews);
}
