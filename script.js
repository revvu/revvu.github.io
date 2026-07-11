/**
 * Reevu Adakroy - Portfolio
 * Content positioning & interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initEntrance();
});

/**
 * Smooth scroll for anchor links within the page
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const targetTop = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: targetTop - 40, behavior: 'smooth' });
      }
    });
  });
}

/**
 * Staggered entrance fade-in on load
 */
function initEntrance() {
  const elements = document.querySelectorAll('.fade-in');
  elements.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('visible');
    }, 200 + i * 150);
  });
}
