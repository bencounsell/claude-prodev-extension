// Site configuration: set these once the store listing and checkout exist.
const CONFIG = {
  storeUrl: '',      // Chrome Web Store listing URL; until set, install buttons scroll to #pricing
  checkoutUrl: '',   // Lemon Squeezy (or Paddle) checkout URL for Pro
  price: '$29',      // shown on the Pro plan
};

for (const a of document.querySelectorAll('[data-store]')) if (CONFIG.storeUrl) { a.href = CONFIG.storeUrl; a.target = '_blank'; a.rel = 'noopener'; }
for (const a of document.querySelectorAll('[data-checkout]')) if (CONFIG.checkoutUrl) { a.href = CONFIG.checkoutUrl; a.target = '_blank'; a.rel = 'noopener'; }
for (const el of document.querySelectorAll('[data-price]')) el.textContent = CONFIG.price;

// Feature loops play only while on screen. With reduced motion they stay paused and show controls.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loops = [...document.querySelectorAll('video[data-auto]')];
if (reduce) {
  for (const v of loops) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; }
} else if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting) { v.preload = 'auto'; v.play().catch(() => { v.controls = true; }); }
      else v.pause();
    }
  }, { rootMargin: '120px 0px', threshold: 0.25 });
  loops.forEach((v) => io.observe(v));
} else {
  for (const v of loops) v.play().catch(() => {});
}

// Product tour dialog.
const tour = document.getElementById('tour');
const tourVideo = tour.querySelector('video');
for (const b of document.querySelectorAll('[data-tour]')) {
  b.addEventListener('click', () => {
    tour.showModal();
    tourVideo.play().catch(() => {});
  });
}
const closeTour = () => { tourVideo.pause(); tour.close(); };
tour.querySelector('[data-close]').addEventListener('click', closeTour);
tour.addEventListener('click', (e) => { if (e.target === tour) closeTour(); });
tour.addEventListener('close', () => tourVideo.pause());
