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
    if (!count) return summary.append(el('p', 'pr__muted', 'No reviews yet. Be the first to share your thoughts.'));
    const left = el('div');
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
    li.append(stars(r.rating), el('h3', null, r.title), el('p', null, r.body), el('p', 'pr__meta', [r.name, date, r.variant].filter(Boolean).join(' · ')));
    return li;
  }

  async function load() {
    more.disabled = true;
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
  }

  more.addEventListener('click', load);
  $('[data-pr-open]').addEventListener('click', () => { ok.hidden = true; dialog.showModal(); });
  $('[data-pr-close]').addEventListener('click', () => dialog.close());

  const ratingText = $('[data-pr-rating-text]');
  form.addEventListener('change', (e) => { if (e.target.name === 'rating') ratingText.textContent = `${e.target.value} of 5`; });
  form.addEventListener('reset', () => { ratingText.textContent = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = ok.hidden = true;
    const fd = new FormData(form);
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
  });

  load();
});
}
initializeReviews();
if (!window.productReviewsInitialized) {
  window.productReviewsInitialized = true;
  document.addEventListener('shopify:section:load', initializeReviews);
}
