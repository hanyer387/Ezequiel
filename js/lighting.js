(() => {
  'use strict';
  window.Travesia.modules.lighting = function (context) {
    const table = document.querySelector('#navigation-table');
    const light = document.querySelector('.table-lantern');
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    let box = null, size = null, frame = 0, point = null, visible = false, scrolled = 0;
    function hide() {
      cancelAnimationFrame(frame); frame = 0;
      box = null; point = null;
      if (visible) { light.style.opacity = '0'; visible = false; }
    }
    function paint() {
      frame = 0;
      if (!point || !pointer.matches || context.motion.matches || document.hidden || Date.now() - scrolled < 100) return;
      if (!box) {
        box = table.getBoundingClientRect();
        size = { width: table.clientWidth, height: table.clientHeight };
      }
      if (!box.width || !box.height) return;
      const x = Math.max(0, Math.min(1, (point.x - box.left) / box.width)) * size.width;
      const y = Math.max(0, Math.min(1, (point.y - box.top) / box.height)) * size.height;
      light.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,85px) translate(-50%,-50%)`;
      light.style.opacity = '1'; visible = true;
    }
    table.addEventListener('pointermove', event => {
      if (!pointer.matches || context.motion.matches || (event.pointerType && !['mouse', 'pen'].includes(event.pointerType))) return;
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    }, { passive: true });
    table.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide, { passive: true });
    window.addEventListener('scroll', () => { scrolled = Date.now(); hide(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
    context.on('voyage:frame', () => { scrolled = Date.now(); hide(); });
    context.on('dialog:open', hide);
    context.motion.addEventListener?.('change', hide);
    pointer.addEventListener?.('change', hide);
  };
})();
