(() => {
  'use strict';
  window.Travesia.modules.reveals = function (context) {
    let observer, greeted = false, animations = [];
    const words = [...document.querySelectorAll('#greeting .greeting-word, #greeting .red-period')];
    function cancelGreeting() { animations.forEach(animation => animation.cancel()); animations = []; }
    function greeting() {
      if (greeted) return;
      greeted = true;
      if (context.motion.matches) return;
      words.forEach((word, index) => {
        if (typeof word.animate !== 'function') return;
        animations.push(word.animate([
          { opacity: 0, transform: 'translateY(.5em) rotateZ(1deg)' },
          { opacity: 1, transform: 'translateY(0) rotateZ(0)' }
        ], { duration: 850, delay: index * 170, easing: 'cubic-bezier(.19,1,.22,1)', fill: 'backwards' }));
      });
    }
    function observe() {
      if (observer) return;
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      }), { threshold: .12 });
      document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
    }
    context.on('opening:stage', ({ stage }) => {
      if (stage === 'ready') { cancelGreeting(); greeted = false; }
      if (stage === 'leaving') greeting();
    });
    context.motion.addEventListener?.('change', () => { if (context.motion.matches) cancelGreeting(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGreeting(); });
    document.addEventListener('travesia:opened', () => { greeting(); observe(); });
  };
})();
