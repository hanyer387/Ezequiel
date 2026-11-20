(() => {
  'use strict';
  window.Travesia.modules.opening = function (context) {
    const gate = document.querySelector('#gate');
    const main = document.querySelector('#journey');
    const sign = document.querySelector('#sign');
    const signNow = document.querySelector('#sign-now');
    const status = document.querySelector('#gate-status');
    const greeting = document.querySelector('#greeting');
    let progress = 0, holding = false, finished = false, last = null, frame = 0;
    let pending = null, timer = 0;

    function stage(name) { gate.dataset.state = name; context.emit('opening:stage', { stage: name }); }
    function schedule(callback, delay) {
      clearTimeout(timer);
      timer = 0;
      pending = { callback, remaining: delay, started: Date.now() };
      if (!document.hidden) resumeTimer();
    }
    function resumeTimer() {
      if (!pending || timer || document.hidden) return;
      pending.started = Date.now();
      timer = setTimeout(() => {
        const callback = pending.callback;
        pending = null;
        timer = 0;
        callback();
      }, pending.remaining);
    }
    function pauseTimer() {
      if (!pending || !timer) return;
      clearTimeout(timer);
      timer = 0;
      pending.remaining = Math.max(0, pending.remaining - (Date.now() - pending.started));
    }
    function stop() {
      holding = false;
      last = null;
      cancelAnimationFrame(frame);
      frame = 0;
      if (finished) return;
      stage(progress ? 'paused' : 'ready');
      status.textContent = progress ? 'La tinta espera. Mantén presionado para continuar.' : 'Una promesa. Miles de recuerdos.';
    }
    function reveal() {
      gate.hidden = true;
      stage('open');
      main.inert = false;
      document.body.classList.remove('locked');
      greeting.focus({ preventScroll: true });
      document.dispatchEvent(new Event('travesia:opened'));
      schedule(() => main.classList.remove('journey-arriving'), context.motion.matches ? 0 : 900);
    }
    function leave() {
      stage('leaving');
      gate.classList.add('leaving');
      // The greeting starts appearing underneath the departing paper; scrolling
      // stays locked until the overlay is fully removed.
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      main.classList.add('journey-arriving');
      schedule(reveal, context.motion.matches ? 100 : 900);
    }
    function finish() {
      if (finished) return;
      finished = true;
      holding = false;
      cancelAnimationFrame(frame);
      frame = 0;
      progress = 1;
      sign.style.setProperty('--progress', '1');
      sign.disabled = signNow.disabled = true;
      stage('sealed');
      gate.classList.add('signed');
      status.textContent = 'Compañeros desde el principio. Compañeros en lo que viene.';
      gate.focus({ preventScroll: true });
      schedule(leave, context.motion.matches ? 250 : 1400);
    }
    function tick(time) {
      if (!holding || finished) return;
      if (last !== null) progress = Math.min(1, progress + (time - last) / 2400);
      last = time;
      sign.style.setProperty('--progress', String(progress));
      if (progress >= 1) finish();
      else frame = requestAnimationFrame(tick);
    }
    function start() {
      if (finished || holding) return;
      holding = true;
      last = null;
      stage('signing');
      status.textContent = 'Firmando nuestra promesa…';
      frame = requestAnimationFrame(tick);
    }
    sign.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      sign.setPointerCapture(event.pointerId);
      start();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) sign.addEventListener(name, stop);
    sign.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) start();
    });
    sign.addEventListener('keyup', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      stop();
    });
    // Assistive activation is a complete signature, without a timed hold.
    sign.addEventListener('click', event => { if (event.detail === 0 && !holding) finish(); });
    sign.addEventListener('contextmenu', event => event.preventDefault());
    signNow.addEventListener('click', finish);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stop(); pauseTimer(); }
      else resumeTimer();
    });
    document.querySelector('#replay').addEventListener('click', () => {
      clearTimeout(timer);
      timer = 0;
      pending = null;
      stop();
      finished = false;
      progress = 0;
      sign.disabled = signNow.disabled = false;
      sign.style.setProperty('--progress', '0');
      gate.hidden = false;
      gate.scrollTop = 0;
      gate.classList.remove('signed', 'leaving');
      main.classList.remove('journey-arriving');
      main.inert = true;
      document.body.classList.add('locked');
      stage('ready');
      status.textContent = 'Una promesa. Miles de recuerdos.';
      sign.focus({ preventScroll: true });
    });
    // Initial focus belongs to the dialog, not an automatically highlighted button.
    // Tab still reaches every control and retains its visible keyboard outline.
    gate.focus({ preventScroll: true });
  };
})();
