(() => {
  'use strict';
  window.Travesia.modules.destinations = function (context) {
    const places = window.Travesia.data.destinations;
    const dialog = document.querySelector('#destination-dialog');
    const art = document.querySelector('#destination-art');
    let active = null;
    const open = context.bindDialog(dialog, () => { active?.setAttribute('aria-expanded', 'false'); });
    function miniature(button, key) {
      const source = button.querySelector('svg');
      if (!source) return null;
      const clone = source.cloneNode(true), names = new Map();
      for (const node of [clone, ...clone.querySelectorAll('[id]')]) if (node.id) names.set(node.id, 'preview-' + key + '-' + node.id);
      // Keep SVG defs/clip paths local to the preview; never duplicate atlas IDs.
      for (const node of [clone, ...clone.querySelectorAll('*')]) {
        for (const attribute of [...node.attributes]) {
          let value = attribute.value;
          if (attribute.name === 'id') value = names.get(value) || value;
          else {
            value = value.replace(/url\(#([^)]+)\)/g, (match, id) => names.has(id) ? 'url(#' + names.get(id) + ')' : match);
            if ((attribute.name === 'href' || attribute.name === 'xlink:href') && value.startsWith('#')) value = '#' + (names.get(value.slice(1)) || value.slice(1));
          }
          if (value !== attribute.value) node.setAttribute(attribute.name, value);
        }
      }
      return clone;
    }
    for (const button of document.querySelectorAll('[data-location]')) {
      button.setAttribute('aria-haspopup', button.dataset.memoryTarget ? 'false' : 'dialog');
      button.setAttribute('aria-controls', button.dataset.memoryTarget || 'destination-dialog');
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        if(button.dataset.memoryTarget){
          const sheet=document.querySelector('#'+button.dataset.memoryTarget);
          sheet?.scrollIntoView({behavior:context.motion.matches?'instant':'smooth'});
          sheet?.querySelector('.sheet-title')?.focus({preventScroll:true});
          context.emit('cue',{name:'paper'});return;
        }
        const key = button.dataset.location, place = places[key];
        if (!place || dialog.open) return;
        active = button;
        const preview = miniature(button, key);
        art.replaceChildren(...(preview ? [preview] : []));
        dialog.dataset.destination = key;
        for (const [selector, text] of [['#destination-title', place.name], ['#destination-eyebrow', place.eyebrow], ['#destination-lore', place.lore], ['#destination-meaning', place.meaning]]) document.querySelector(selector).textContent = text;
        if (open(button, { shared: { from: button.querySelector('svg'), to: art.querySelector('svg') } })) {
          button.setAttribute('aria-expanded', 'true');
          context.emit('cue', { name: 'paper' });
        }
      });
    }
    for (const selector of ['.destination-close', '.destination-back']) document.querySelector(selector).addEventListener('click', () => dialog.close());
  };
})();
