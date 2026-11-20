(() => {
  'use strict';
  const modules = Object.create(null);
  function createContext() {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const locks = new Set(), listeners = new Map();
    let previousOverflow = '';
    const visited = new Set();
    const context = {
      motion,
      on(type, callback) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
        return () => listeners.get(type).delete(callback);
      },
      emit(type, detail) { listeners.get(type)?.forEach(callback => callback(detail)); },
      markVisited(id = 'yoga') {
        if (visited.has(id)) return;
        visited.add(id);
        if(id==='yoga')document.querySelector('#visit-state').textContent = '✓ RECUERDO VISITADO · VOLVER A LEER';
        const sheets=[...(document.querySelectorAll?.('.memory-sheet')||[])];
        const letters=new Set(sheets.filter(s=>s.dataset.kind==='letter').map(s=>s.dataset.memory));
        const total=sheets.filter(s=>s.dataset.kind!=='letter').length || 1;
        const count=[...visited].filter(key=>!letters.has(key)).length;
        document.querySelector('#map-count').textContent = total===1?'01 RECUERDO EXPLORADO':String(count).padStart(2,'0')+' / '+String(total).padStart(2,'0')+' RECUERDOS EXPLORADOS';
        if(letters.size)document.querySelector('#map-count').textContent += [...letters].some(key=>visited.has(key))?' · CARTA LEIDA':' · UNA CARTA PARA TI';
      },
      bindDialog(dialog, onClose) {
        let opener = null, animation = null, sharedAnimation = null, sharedSource = null, oldVisibility = '';
        dialog.addEventListener('close', () => {
          animation?.cancel(); sharedAnimation?.cancel();
          animation = sharedAnimation = null;
          if (sharedSource) {
            sharedSource.style.visibility = oldVisibility;
            if (!motion.matches && typeof sharedSource.animate === 'function') sharedSource.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 180 });
            sharedSource = null;
          }
          locks.delete(dialog);
          if (!locks.size) document.body.style.overflow = previousOverflow;
          context.emit('dialog:close', { count: locks.size });
          onClose?.();
          if (opener?.isConnected !== false) opener?.focus?.({ preventScroll: true });
        });
        motion.addEventListener?.('change', () => { if (motion.matches) { animation?.cancel(); sharedAnimation?.cancel(); } });
        dialog.addEventListener('click', event => {
          if (event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        });
        return (source, options = {}) => {
          if (dialog.open) return false;
          // Read origin once per user action, never in a scroll handler.
          const originNode = options.shared?.from || source;
          const origin = !motion.matches ? originNode?.getBoundingClientRect?.() : null;
          if (!locks.size) previousOverflow = document.body.style.overflow;
          dialog.showModal();
          opener = source || document.activeElement;
          locks.add(dialog);
          document.body.style.overflow = 'hidden';
          dialog.scrollTop = 0;
          const shared = options.shared?.to;
          if (origin && origin.width > 0 && origin.height > 0 && typeof shared?.animate === 'function') {
            const box = shared.getBoundingClientRect();
            if (box.width > 0 && box.height > 0) {
              sharedSource = originNode;
              oldVisibility = sharedSource.style.visibility;
              sharedSource.style.visibility = 'hidden';
              sharedAnimation = shared.animate([
                { transformOrigin: '0 0', transform: `translate(${origin.left - box.left}px,${origin.top - box.top}px) scale(${origin.width / box.width},${origin.height / box.height})` },
                { transformOrigin: '0 0', transform: 'translate(0,0) scale(1,1)' }
              ], { duration: 580, easing: 'cubic-bezier(.19,1,.22,1)' });
              if (typeof dialog.animate === 'function') animation = dialog.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 220 });
            }
          } else if (origin && typeof dialog.animate === 'function') {
            const box = dialog.getBoundingClientRect();
            const dx = Math.max(-window.innerWidth * .45, Math.min(window.innerWidth * .45, origin.left + origin.width / 2 - box.left - box.width / 2));
            const dy = Math.max(-window.innerHeight * .45, Math.min(window.innerHeight * .45, origin.top + origin.height / 2 - box.top - box.height / 2));
            animation = dialog.animate([
              { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.86)` },
              { opacity: 1, transform: 'translate(0,0) scale(1)' }
            ], { duration: 460, easing: 'cubic-bezier(.19,1,.22,1)' });
          }
          context.emit('dialog:open', { count: locks.size });
          return true;
        };
      }
    };
    return context;
  }
  window.Travesia = { modules, createContext, data: {} };
})();
