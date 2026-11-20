(() => {
  'use strict';
  window.Travesia.modules.audio = function (context) {
    const query = selector => document.querySelector(selector);
    const buttons = [query('#sound'), query('#opening-sound')];
    const panel = query('#audio-settings'), settings = query('#audio-settings-toggle');
    const volumeControl = query('#ambience-volume'), effectsControl = query('#audio-effects');
    const track = query('#soundtrack'), trackStatus = query('#soundtrack-status');
    let enabled = false, failed = false, applying = false, dirty = false, decided = false, blocked = false;
    let audio = null, master = null, sea = null, effects = null, noise = null, ink = null;
    let volume = Number(volumeControl.value || 20) / 100, effectsEnabled = effectsControl.checked !== false;
    let phase = 'sailing', dialogs = 0;
    let signed = false, positioned = false, metadataRequested = false;
    const startAt = Math.max(0, Number(track.dataset.start || 0));
    function render() {
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(enabled));
        button.setAttribute('aria-label', failed ? 'Sonido no disponible. Intentar de nuevo' : blocked ? 'Reproducir musica' : enabled ? 'Silenciar musica y ambiente' : 'Activar musica y ambiente');
        button.querySelector('span').textContent = failed ? 'NO DISPONIBLE' : blocked ? 'REINTENTAR' : enabled ? 'ON' : 'OFF';
      }
    }
    // The supplied track shares the existing controls and stays quiet during reading.
    function syncTrack() {
      if (!track.getAttribute('src')) return;
      const level = Math.max(0, Math.min(1, volume * (dialogs ? .45 : phase === 'reading' ? .7 : 1)));
      // Native playback is independent of Web Audio, including file:// and data: previews.
      track.volume = level;
      if (!signed || !enabled || document.hidden) { track.pause(); return; }
      if (!positioned) {
        try { track.currentTime = startAt; positioned = true; }
        catch {
          if (!metadataRequested) { metadataRequested = true; track.load?.(); }
          return;
        }
      }
      if (!track.paused) return;
      trackStatus.hidden = true;
      function rejected(error) {
        if (!signed || !enabled || document.hidden || error?.name === 'AbortError') return;
        blocked = true; render();
        trackStatus.textContent = 'Toca SONIDO para reproducir la musica.';
        trackStatus.hidden = false;
      }
      try {
        Promise.resolve(track.play()).then(() => {
          if (!signed || !enabled || document.hidden) { track.pause(); return; }
          blocked = false; failed = false; trackStatus.hidden = true; render();
        }, rejected);
      } catch (error) { rejected(error); }
    }

    function target() {
      syncTrack();
      if (!audio) return;
      const now = audio.currentTime;
      master.gain.setTargetAtTime(enabled && !document.hidden ? volume : 0, now, .025);
      sea.gain.setTargetAtTime(track.getAttribute('src') ? .035 : dialogs ? .055 : phase === 'reading' ? .08 : .18, now, .45);
      effects.gain.setTargetAtTime(effectsEnabled ? .3 : 0, now, .02);
    }
    function createSea() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      audio = new Audio();
      master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination);
      sea = audio.createGain(); sea.gain.value = .18; sea.connect(master);
      effects = audio.createGain(); effects.gain.value = .3; effects.connect(master);
      const buffer = audio.createBuffer(1, audio.sampleRate * 6, audio.sampleRate);
      const data = buffer.getChannelData(0); let brown = 0;
      for (let i = 0; i < data.length; i++) {
        brown = (brown + Math.random() * .04 - .02) / 1.02;
        const edge = Math.min(1, i / (audio.sampleRate * .2), (data.length - 1 - i) / (audio.sampleRate * .2));
        data[i] = brown * 3 * edge;
      }
      noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const grain = noise.getChannelData(0);
      for (let i = 0; i < grain.length; i++) grain[i] = Math.random() * 2 - 1;
      const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 550;
      const wave = audio.createOscillator(), depth = audio.createGain();
      wave.frequency.value = .13; depth.gain.value = .045;
      wave.connect(depth).connect(sea.gain); source.connect(filter).connect(sea);
      source.start(); wave.start();
    }

    // Serialize resume/suspend. Fast ON/OFF taps cannot leave audio playing after OFF.
    async function reconcile() {
      dirty = true;
      if (applying) return;
      applying = true;
      try {
        while (dirty) {
          dirty = false;
          if (enabled && !document.hidden) {
            if (!audio) createSea();
            await audio.resume();
            target();
          } else if (audio) {
            target();
            await audio.suspend();
          }
        }
      } catch {
        // Sea/effect failures must not switch off an independently playable song.
        if (!track.getAttribute('src')) { enabled = false; failed = true; }
        syncTrack();
        try { await audio?.close?.(); } catch { /* Optional effects remain unavailable. */ }
        audio = master = sea = effects = noise = null;
      } finally { applying = false; render(); }
    }
    function canPlay() { return enabled && effectsEnabled && !document.hidden && audio?.state === 'running'; }
    function noiseCue(duration, cutoff, peak) {
      if (!canPlay()) return null;
      const now = audio.currentTime, source = audio.createBufferSource();
      const filter = audio.createBiquadFilter(), envelope = audio.createGain();
      source.buffer = noise; source.loop = duration > 1;
      filter.type = 'bandpass'; filter.frequency.value = cutoff; filter.Q.value = .7;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(peak, now + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.connect(filter).connect(envelope).connect(effects);
      source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
      source.start(now); source.stop(now + duration + .02);
      return () => { try { source.stop(audio.currentTime + .015); } catch { /* Already ended. */ } };
    }
    function knock() {
      if (!canPlay()) return;
      const now = audio.currentTime, voice = audio.createOscillator(), envelope = audio.createGain();
      voice.type = 'sine'; voice.frequency.setValueAtTime(125, now); voice.frequency.exponentialRampToValueAtTime(55, now + .14);
      envelope.gain.setValueAtTime(.16, now); envelope.gain.exponentialRampToValueAtTime(.0001, now + .18);
      voice.connect(envelope).connect(effects);
      voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
      voice.start(now); voice.stop(now + .2);
    }
    function cue(name) {
      if (!canPlay()) return;
      try {
        if (name === 'seal' || name === 'dock') knock();
        else noiseCue(name === 'ink' ? 2.5 : .18, name === 'ink' ? 1450 : 850, name === 'ink' ? .055 : .12);
      } catch { /* Optional effects never interrupt navigation. */ }
    }
    function closeSettings(focus = false) {
      panel.hidden = true; settings.setAttribute('aria-expanded', 'false');
      if (focus) settings.focus({ preventScroll: true });
    }
    for (const button of buttons) button.addEventListener('click', () => {
      decided = true; failed = false;
      if (blocked && enabled) { blocked = false; render(); syncTrack(); reconcile(); return; }
      blocked = false; enabled = !enabled;
      if (!enabled) { ink?.(); ink = null; }
      render(); syncTrack(); reconcile();
    });
    volumeControl.addEventListener('input', () => {
      volume = Math.max(0, Math.min(1, Number(volumeControl.value) / 100)); target();
    });
    effectsControl.addEventListener('change', () => {
      effectsEnabled = effectsControl.checked; if (!effectsEnabled) { ink?.(); ink = null; } target();
    });
    settings.addEventListener('click', () => {
      panel.hidden = !panel.hidden; settings.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) volumeControl.focus({ preventScroll: true });
    });
    query('#audio-settings-close').addEventListener('click', () => closeSettings(true));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) closeSettings(true); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { ink?.(); ink = null; } syncTrack(); reconcile();
    });
    track.addEventListener('loadedmetadata', () => { if (!positioned) syncTrack(); });
    // A touch release can unlock media on browsers that reject pointer-down playback.
    for (const name of ['pointerup','keyup']) query('#sign').addEventListener(name, () => { if (enabled) syncTrack(); });
    context.on('cue', ({ name }) => cue(name));
    context.on('opening:stage', ({ stage }) => {
      // Only a completed signature unlocks music; partial strokes stay silent.
      if (stage === 'ready') { signed = false; positioned = false; metadataRequested = false; blocked = false; syncTrack(); render(); }
      if (stage === 'sealed') {
        signed = true;
        if (!decided && track.getAttribute('src')) { decided = true; enabled = true; }
        render(); syncTrack(); reconcile();
      }
      ink?.(); ink = null;
      if (stage === 'signing' && canPlay()) {
        try { ink = noiseCue(2.5, 1450, .055); } catch { /* Optional. */ }
      }
      if (stage === 'sealed') cue('seal');
      if (stage === 'ready') closeSettings();
    });
    context.on('voyage:phase', ({ phase: next }) => {
      phase = next; target();
      if (next === 'reading') cue('dock');
      if (next === 'departing') cue('paper');
    });
    context.on('dialog:open', ({ count }) => { dialogs = count; closeSettings(); target(); });
    context.on('dialog:close', ({ count }) => { dialogs = count; target(); });
    render();
  };
})();
