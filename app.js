// Composition root: initialize independent features once, in dependency order.
(() => {
 'use strict';
 const app = window.Travesia;
 const context = app.createContext();
 for (const name of ['reveals', 'audio', 'memories', 'destinations', 'voyage', 'lighting', 'opening']) {
  app.modules[name](context);
 }
})();
