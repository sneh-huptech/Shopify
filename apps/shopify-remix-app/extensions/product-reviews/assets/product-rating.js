(() => {
  function initializeProductRatings() {
    document.querySelectorAll('[data-pr-rating]:not([data-rating-ready])').forEach(async (root) => {
      root.dataset.ratingReady = 'true';
      try {
        const response = await fetch(`${root.dataset.endpoint}?productId=${encodeURIComponent(root.dataset.productId)}&page=1`);
        if (!response.ok) return;
        const { stats } = await response.json();
        if (!Number.isInteger(stats?.count) || stats.count < 0 || !Number.isFinite(stats.average) || stats.average < 0 || stats.average > 5) return;
        if (!stats.count && root.dataset.showEmpty !== 'true') return;
        const text = stats.count ? `${stats.average.toFixed(1)} · ${stats.count} ${stats.count === 1 ? 'review' : 'reviews'}` : 'No reviews yet';
        root.querySelector('[data-pr-rating-stars]').setAttribute('aria-label', stats.count ? `${stats.average.toFixed(1)} out of 5 stars` : 'No ratings yet');
        root.querySelectorAll('.pr-rating__star').forEach((star, index) => {
          star.style.setProperty('--fill', `${Math.max(0, Math.min(1, stats.average - index)) * 100}%`);
        });
        const label = root.querySelector('[data-pr-rating-label]');
        label.textContent = text;
        const link = root.querySelector('[data-pr-rating-link]');
        const widget = [...document.querySelectorAll('[data-pr-root]')].find((section) => section.dataset.productId === root.dataset.productId);
        if (widget) {
          if (!widget.id) widget.id = `product-reviews-${root.dataset.productId}`;
          link.href = `#${widget.id}`;
          link.textContent = text;
          link.hidden = false;
          label.hidden = true;
          link.addEventListener('click', (event) => {
            const target = document.getElementById(widget.id);
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
            const heading = target.querySelector('h2');
            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
          });
        }
        root.hidden = false;
      } catch {
        // Hide unavailable ratings rather than displaying a misleading zero.
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeProductRatings, { once: true });
  else initializeProductRatings();
  document.addEventListener('shopify:section:load', initializeProductRatings);
})();
