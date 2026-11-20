/* Keep the active island reachable inside the phone's horizontal route menu.
   Never scroll the document, capture touch movement, or change voyage timing. */
(() => {
  const nav = document.querySelector('.voyage-nav');
  const chart = document.querySelector('#chart');
  if (!nav || !chart || typeof MutationObserver === 'undefined') return;
  const small = matchMedia('(max-width:700px), (max-width:1000px) and (max-height:500px)');
  let frame = 0, interacting = false, idle = 0;
  function revealActive() {
    frame = 0;
    if (!small.matches || interacting || !document.body.classList.contains('voyage-visible')) return;
    const active = nav.querySelector('[aria-current="step"]');
    if (!active) return;
    const menu = nav.getBoundingClientRect(), item = active.getBoundingClientRect();
    const delta = item.left < menu.left + 12 ? item.left - menu.left - 12
      : item.right > menu.right - 12 ? item.right - menu.right + 12 : 0;
    if (delta) nav.scrollLeft += delta;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(revealActive); }
  nav.addEventListener('pointerdown', () => { interacting = true; clearTimeout(idle); }, { passive: true });
  function release() { clearTimeout(idle); idle = setTimeout(() => { interacting = false; }, 800); }
  nav.addEventListener('pointerup', release, { passive: true });
  nav.addEventListener('pointercancel', release, { passive: true });
  new MutationObserver(schedule).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  small.addEventListener('change', schedule);
})();
