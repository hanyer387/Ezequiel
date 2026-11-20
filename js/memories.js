(() => {
  'use strict';
  window.Travesia.modules.memories = function (context) {
    const query = selector => document.querySelector(selector);
    const dialog = query('#memory'), island = query('#island');
    const reading = query('#memory-reading'), guide = query('#reading-guide');
    const sheets = [...document.querySelectorAll('.memory-sheet')];
    let current = sheets[0] || null;
    let readToEnd = false, readingVisible = false, dialogs = 0;
    const ratios = new Map(), curls = new Map(), ends = new Map(), seen = new Set();
    const turns = new Set();
    function animateSheet(sheet, leaving = false) {
      if (context.motion.matches || typeof sheet?.animate !== 'function') return;
      const small = window.innerWidth <= 700;
      const tilt = small ? 3 : 9, shift = small ? 4 : 18;
      const animation = sheet.animate(leaving ? [
        { transform: 'perspective(1800px) rotateY(0)', opacity: 1 },
        { transform: `perspective(1800px) rotateY(-${tilt}deg) translateX(-${shift}px)`, opacity: .8, offset: .65 },
        { transform: 'perspective(1800px) rotateY(0)', opacity: 1 }
      ] : [
        { transform: `perspective(1800px) rotateY(${small ? 3 : 7}deg) translateX(${small ? 4 : 15}px)`, opacity: .4 },
        { transform: 'perspective(1800px) rotateY(0)', opacity: 1 }
      ], { duration: leaving ? 620 : 520, easing: 'cubic-bezier(.19,1,.22,1)' });
      turns.add(animation);
      if (animation.finished) animation.finished.then(() => turns.delete(animation), () => turns.delete(animation));
    }
    function measureSheets() {
      sheets.forEach(sheet => {
        const box = sheet.getBoundingClientRect();
        ends.set(sheet, box.bottom + window.scrollY);
      });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { turns.forEach(animation => animation.cancel()); turns.clear(); } });
    context.on('voyage:measure', measureSheets);
    context.on('voyage:frame', ({ y, height }) => {
      sheets.forEach(sheet => {
        const curl = sheet.querySelector('.sheet-curl'), end = ends.get(sheet);
        if (!curl || end === undefined) return;
        const p = context.motion.matches ? 0 : Math.max(0, Math.min(1, (y - end + height * .65) / (height * .6)));
        const value = p.toFixed(3);
        if (curls.get(sheet) === value) return;
        curls.set(sheet, value);
        curl.style.setProperty('--turn', value);
      });
    });
    context.motion.addEventListener?.('change', () => {
      if (context.motion.matches) {
        turns.forEach(animation => animation.cancel()); turns.clear();
        sheets.forEach(sheet => sheet.querySelector('.sheet-curl')?.style.setProperty('--turn', '0'));
        curls.clear();
      }
    });
    const open = context.bindDialog(dialog, () => { if (readToEnd) context.markVisited(current?.dataset.memory || 'yoga'); });
    function checkEnd() {
      if (dialog.open && dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight - 32) readToEnd = true;
    }
    function launch(source) {
      if (dialog.open) return;
      readToEnd = false;
      if (current) {
        const emblem=current.querySelector('.memory-emblem');
        query('#memory-emblem').replaceChildren(...[...(emblem?.childNodes||[])].map(node=>node.cloneNode(true)));
        for (const [from, to] of [['.sheet-title', '#memory-title'], ['.sheet-story', '#memory .story'], ['.crew-note', '#memory .crew-note']]) {
          const content = current.querySelector(from);
          query(to).replaceChildren(...[...content.childNodes].map(node => node.cloneNode(true)));
        }
        query('#memory .eyebrow').textContent = current.querySelector('.sheet-meta').textContent;
        query('#memory .margin-note').textContent = current.querySelector('.margin-note').textContent;
      }
      if (open(source)) { checkEnd(); context.emit('cue', { name: 'paper' }); }
    }
    island.setAttribute('aria-controls', 'memory-reading');
    island.addEventListener('click', () => {
      current=sheets[0] || null;
      reading.scrollIntoView({ behavior: context.motion.matches ? 'instant' : 'smooth' });
      context.emit('cue', { name: 'paper' });
    });
    for (const selector of ['#read-full', '#reading-open-full']) {
      const button = query(selector);
      button.addEventListener('click', () => launch(button));
    }
    for (const selector of ['#memory .close-memory', '#memory .back-map']) query(selector).addEventListener('click', () => dialog.close());
    dialog.addEventListener('scroll', checkEnd, { passive: true });
    for (const link of document.querySelectorAll('.memory-sheet .next-leg-link')) link.addEventListener('click', event => {
      if (event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      animateSheet(link.closest('.memory-sheet'), true);
      context.emit('cue', { name: 'paper' });
      // The anchor retains native navigation/history; no delayed or trapped scroll.
    });
    // Observe whole leaves, never individual paragraphs. Scroll stays native.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === reading) readingVisible = entry.isIntersecting;
        else {
          ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
          if (entry.isIntersecting && !seen.has(entry.target)) { seen.add(entry.target); animateSheet(entry.target); }
        }
      }
      guide.hidden = !readingVisible || dialogs > 0;
      const selected = sheets.filter(sheet => (ratios.get(sheet) || 0) > 0)
        .sort((a, b) => ratios.get(b) - ratios.get(a))[0];
      if (selected) current = selected;
      guide.hidden = !selected || !readingVisible || dialogs > 0;
      if (current) query('#reading-step-label').textContent = current.dataset.kind==='letter'?'CARTA PARA TI':'BITÁCORA / ' + String(current.dataset.sheetIndex).padStart(2, '0');
    }, { rootMargin: '-12% 0px -18% 0px', threshold: [0, .05, .15, .3, .55] });
    observer.observe(reading);
    sheets.forEach(sheet => observer.observe(sheet));
    context.on('dialog:open', ({ count }) => { dialogs = count; guide.hidden = true; });
    context.on('dialog:close', ({ count }) => { dialogs = count; guide.hidden = !readingVisible || count > 0 || !sheets.some(sheet=>(ratios.get(sheet)||0)>0); });
  };
})();
