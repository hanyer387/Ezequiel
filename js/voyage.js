(() => {
  'use strict';
  window.Travesia.modules.voyage = function (context) {
    const query = selector => document.querySelector(selector);
    const chart = query('#chart');
    const table = query('#navigation-table');
    const stage = query('.chart-stage');
    const sail = query('.ship-sail');
    const heading = query('.chart-heading');
    const lights = [query('.room-light-green'), query('.room-light-gold')];
    const caption = [query('.chart-scroll'), query('.chart-ready')];
    const indicator = query('.chapter-progress span');
    const label = query('.leg-label');
    const departureText = query('.departure-message');
    const wake = query('.boat-wake');
    const island = query('#island');
    const ship = query('#voyage-ship');
    const status = query('#voyage-status');
    const legs = document.querySelectorAll('[data-leg]');
    const board = query('.map-sheet');
    const land = query('.island-home');
    const origin = query('.destination-foosha');
    const paths = { inbound: query('#sailing-path'), outbound: query('#departure-path') };
    const silhouette = query('#route-silhouette');
    const reading = query('#memory-reading');
    const departure = query('#voyage-departure');
    const horizon = query('#next-horizon');
    const sheets = [...document.querySelectorAll('.memory-sheet')];
    const multi = sheets.length > 1;
    const stopLinks = [...document.querySelectorAll('[data-stop-link]')];
    let journeyRoutes = [], journeyPaths = [], activeStop = '';
    const reducedMotion = context.motion;
    const { clamp, stateAt, mixHeading, framingAt, routeAt, journeyAt, journeyFramingAt, passageAt } = VoyageEngine;
    const camera = { frame: 0, measureFrame: 0, metrics: null, phase: '', lastY: NaN, lastWidth: 0 };
    const styles = new WeakMap();
    let geometryKey = '', routes = {}, navVisible = false, visited = false, lastBoat = '';

    // Only mutate a rendered value when it actually changes. No inherited scroll
    // variables on #chart: the story and SVG descendants need no style invalidation.
    function paint(element, property, value) {
      let previous = styles.get(element);
      if (!previous) styles.set(element, previous = new Map());
      if (previous.get(property) === value) return;
      previous.set(property, value);
      if (value === null) element.style.removeProperty(property);
      else element.style.setProperty(property, value);
    }

    function sample(path) {
      const length = path.getTotalLength();
      const points = Array.from({ length: 257 }, (_, i) => path.getPointAtLength(length * i / 256));
      // Tangents come from the same samples, including both exact endpoints.
      return { length, points, headings: points.map((_, i) => {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(256, i + 1)];
        return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      }) };
    }

    function poseAt(route, progress) {
      const index = clamp(progress) * 256;
      const lo = Math.min(255, Math.floor(index)), t = index - lo;
      const a = route.points[lo], b = route.points[lo + 1];
      const angle = route.headings[lo];
      const turn = ((route.headings[lo + 1] - angle + 540) % 360) - 180;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: angle + turn * t };
    }

    function measureCamera() {
      const pageTop = element => element.getBoundingClientRect().top + window.scrollY;
      const start = pageTop(chart);
      const metrics = {
        start, arrival: pageTop(reading) - (window.innerWidth <= 700 ? 125 : 155), readingEnd: pageTop(departure),
        end: pageTop(horizon), bottom: start + chart.offsetHeight, vh: stage.clientHeight || window.innerHeight
      };
      // Read all layout before changing SVG attributes or styles.
      const w = board.clientWidth, h = board.clientHeight;
      metrics.boardWidth = w;
      if (multi) metrics.stops = sheets.map((sheet,i) => {
        const key = sheet.dataset.destination;
        const miniature = key === 'little' ? land : query('[data-location="'+key+'"]');
        const x = miniature.offsetLeft + miniature.offsetWidth * (key==='little' ? 190/360 : .5);
        const py = miniature.offsetTop + miniature.offsetHeight * (key==='little' ? 282/300 : .68) + 7;
        const next = sheets[i+1];
        return {id:sheet.dataset.memory,name:sheet.dataset.place,key,x:x/w,y:py/h,passage:JSON.parse(sheet.dataset.passage||'[]'),
          arrival:pageTop(sheet)-(window.innerWidth<=700?125:155),
          readingEnd:next?pageTop(query('#voyage-to-'+next.dataset.memory))-metrics.vh*.3:metrics.readingEnd};
      });
      const anchors = [w, h, origin.offsetLeft, origin.offsetTop, origin.offsetWidth,
        origin.offsetHeight, land.offsetLeft, land.offsetTop, land.offsetWidth, land.offsetHeight];
      if (!(w > 0 && h > 0 && metrics.start < metrics.arrival &&
          metrics.arrival < metrics.readingEnd && metrics.readingEnd < metrics.end)) return;
      if (multi && !metrics.stops.every((stop,i)=> (i?metrics.stops[i-1].readingEnd:metrics.start)<stop.arrival && stop.arrival<stop.readingEnd && stop.readingEnd<metrics.end)) return;
      metrics.boardHeight = h + 2 * (window.innerWidth <= 700 ? 12 : 36);
      camera.metrics = metrics;
      context.emit('voyage:measure', { height: metrics.vh });
      const key = anchors.join(',') + (multi ? JSON.stringify(metrics.stops.map(s=>[s.x,s.y])) : '');
      if (key !== geometryKey) {
        geometryKey = key;
        const scale = Math.min(w / 1000, h / 580), ox = (w - 1000 * scale) / 2, oy = (h - 580 * scale) / 2;
        const toSVG = (x, y) => ({ x: (x - ox) / scale, y: (y - oy) / scale });
        // Foosha port at (156,164) in its 200-wide miniature.
        const from = toSVG(anchors[2] + anchors[4] * 156 / 200, anchors[3] + anchors[4] * 164 / 200);
        const dock = toSVG(anchors[6] + anchors[8] * 190 / 360, anchors[7] + anchors[9] * 282 / 300 + 7);
        const next = toSVG(w * .85, h * .78);
        const { inbound, outbound } = routeAt(from, dock, next);
        paths.inbound.setAttribute('d', inbound);
        paths.outbound.setAttribute('d', outbound);
        silhouette.setAttribute('d', inbound + ' ' + outbound);
        // SVG geometry is queried only when the board's dimensions/anchors change.
        routes = { inbound: sample(paths.inbound), outbound: sample(paths.outbound) };
        for (const leg of ['inbound', 'outbound']) paint(paths[leg], 'stroke-dasharray', String(routes[leg].length));
        if (multi) {
          const docks = metrics.stops.map(s=>toSVG(s.x*w,s.y*h));
          const ports = [from,...docks,next];
          // Shared endpoint tangents keep the ship from rotating in place at a stop.
          const tangents = ports.map((p,i)=>{
            const a=ports[Math.max(0,i-1)],b=ports[Math.min(ports.length-1,i+1)];
            const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
            return {x:(b.x-a.x)/length*55,y:(b.y-a.y)/length*55};
          });
          while(journeyPaths.length<ports.length-1){
            const path=document.createElementNS('http://www.w3.org/2000/svg','path');
            for(const [name,value] of Object.entries({fill:'none',stroke:'#dfc795','stroke-width':'2','stroke-linecap':'round'}))path.setAttribute(name,value);
            paths.inbound.parentNode.insertBefore(path,ship);journeyPaths.push(path);
          }
          const curves=ports.slice(1).map((b,i)=>{
            const a=ports[i],ta=tangents[i],tb=tangents[i+1];
            const via=(metrics.stops[i]?.passage||[]).map(([x,y])=>toSVG(x*w,y*h));
            return passageAt(a,b,ta,tb,via);
          });
          curves.forEach((d,i)=>journeyPaths[i].setAttribute('d',d));
          silhouette.setAttribute('d',curves.join(' '));
          journeyRoutes=journeyPaths.map(sample);
          journeyRoutes.forEach((r,i)=>paint(journeyPaths[i],'stroke-dasharray',String(r.length)));
          paint(paths.inbound,'display','none');paint(paths.outbound,'display','none');
        }
        lastBoat = '';
      }
      camera.lastY = NaN;
      queueCamera();
    }

    function queueMeasure() {
      if (camera.measureFrame || document.hidden) return;
      cancelAnimationFrame(camera.frame);
      camera.frame = 0;
      camera.measureFrame = requestAnimationFrame(() => {
        camera.measureFrame = 0;
        measureCamera();
      });
    }

    function queueCamera() {
      if (!camera.frame && !camera.measureFrame && !document.hidden) camera.frame = requestAnimationFrame(drawCamera);
    }

    function drawCamera() {
      camera.frame = 0;
      if (!camera.metrics) return;
      const y = window.scrollY, width = window.innerWidth, metrics = camera.metrics;
      if (y === camera.lastY && width === camera.lastWidth) return;
      camera.lastY = y;
      camera.lastWidth = width;
      const visible = y >= metrics.start - 80 && y < metrics.bottom - 100;
      if (visible !== navVisible) {
        navVisible = visible;
        document.body.classList.toggle('voyage-visible', visible);
      }
      // The hero/footer still scroll natively; their frames do not redraw the map.
      if (y + metrics.vh < metrics.start - 160 || y > metrics.bottom + 160) return;
      const state = multi ? journeyAt(y, metrics) : stateAt(y, metrics), reduce = reducedMotion.matches;
      const framing = (multi ? journeyFramingAt : framingAt)(y, metrics, { width, height: metrics.vh, boardHeight: metrics.boardHeight, boardWidth: metrics.boardWidth });
      const t = state.approach, f = framing.focus;
      context.emit('voyage:frame', { y, height: metrics.vh });
      if (reduce) {
        paint(table, 'transform', null);
        paint(table, 'opacity', null);
        paint(heading, 'transform', null);
        paint(heading, 'opacity', '1');
        lights.forEach(light => paint(light, 'transform', null));
      } else {
        const scale = framing.scale.toFixed(4), angle = framing.tilt.toFixed(3), roll = framing.roll.toFixed(3);
        paint(table, 'transform', `translate3d(${framing.x.toFixed(2)}px,${framing.y.toFixed(2)}px,${framing.z.toFixed(2)}px) rotateX(${angle}deg) rotateZ(${roll}deg) scale(${scale})`);
        paint(table, 'opacity', framing.opacity.toFixed(3));
        paint(heading, 'opacity', clamp(1 - t * 3).toFixed(3));
        paint(heading, 'transform', `translate3d(0,${(-t * 65).toFixed(2)}px,0)`);
        paint(lights[0], 'transform', `translateY(${(-state.total * 45).toFixed(2)}px)`);
        paint(lights[1], 'transform', `translateY(${(state.total * 65).toFixed(2)}px)`);
      }
      paint(indicator, 'transform', `scaleY(${(reduce ? 1 : state.total).toFixed(4)})`);
      paint(island, 'opacity', (reduce ? 1 : 1 - f).toFixed(3));
      if (island.inert !== (f > .5 && !reduce)) island.inert = f > .5 && !reduce;
      paint(label, 'opacity', (reduce ? 1 : 1 - f).toFixed(3));
      paint(departureText, 'opacity', (reduce ? 1 : clamp((state.departure - .4) * 2)).toFixed(3));
      const headingOpacity = reduce ? 0 : clamp(1 - t * 3);
      paint(caption[0], 'opacity', headingOpacity.toFixed(3));
      paint(caption[1], 'opacity', (1 - headingOpacity).toFixed(3));

      const leg = multi ? state.routeIndex : reduce ? 'inbound' : state.boatLeg;
      const progress = reduce ? 1 : state.boatProgress;
      const boatKey = leg + ':' + progress + ':' + reduce;
      if (boatKey !== lastBoat) {
        lastBoat = boatKey;
        const point = poseAt(multi ? journeyRoutes[leg] : routes[leg], progress);
        if (!multi && leg === 'outbound') point.angle = mixHeading(routes.inbound.headings[256], point.angle, progress / .15);
        ship.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${point.angle.toFixed(2)}) scale(.78)`);
        // Wind comes from scroll position, without a permanent idle animation.
        paint(sail, 'transform', reduce ? null : `skewX(${(Math.sin(progress * Math.PI * 8) * Math.sin(progress * Math.PI) * 2).toFixed(2)}deg)`);
      }
      paint(paths.inbound, 'stroke-dashoffset', String(reduce ? 0 : routes.inbound.length * (1 - (state.boatLeg === 'inbound' ? progress : 1))));
      paint(paths.outbound, 'stroke-dashoffset', String(reduce ? 0 : routes.outbound.length * (1 - (state.boatLeg === 'outbound' ? progress : 0))));
      if(multi) journeyRoutes.forEach((r,i)=>paint(journeyPaths[i],'stroke-dashoffset',String(r.length*(1-(i<state.routeIndex?1:i===state.routeIndex?progress:0)))));
      paint(wake, 'opacity', state.phase === 'reading' ? '0.12' : '0.6');
      if (state.phase !== camera.phase || (multi && activeStop !== metrics.stops[state.stopIndex].id)) {
        if(multi){
          const stop=metrics.stops[state.stopIndex];activeStop=stop.id;chart.dataset.stop=stop.id;
          for(const link of stopLinks){if(link.dataset.stopLink===stop.id&&state.phase==='reading')link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');}
        }
        camera.phase = state.phase;
        chart.dataset.phase = state.phase;
        context.emit('voyage:phase', { phase: state.phase });
        status.textContent = { sailing: 'RUMBO A LITTLE GARDEN', reading: 'ATRACADOS · EL BARCO ESPERA',
          departing: 'VOLVEMOS A ZARPAR', horizon: 'LA AVENTURA CONTINÚA' }[state.phase];
        if(multi)status.textContent=state.phase==='reading'?'ATRACADOS EN '+metrics.stops[state.stopIndex].name+' · EL BARCO ESPERA':state.phase==='sailing'?'RUMBO A '+metrics.stops[state.stopIndex].name:state.phase==='departing'?'VOLVEMOS A ZARPAR':'LA AVENTURA CONTINUA';
        for (const link of legs) {
          if (link.dataset.leg === (state.phase === 'horizon' ? 'departing' : state.phase)) link.setAttribute('aria-current', 'step');
          else link.removeAttribute('aria-current');
        }
      }
      if(multi && state.phase==='reading' && state.reading>.95)context.markVisited(metrics.stops[state.stopIndex].id);
      if (!multi && !visited && state.reading > .95) { visited = true; context.markVisited(); }
    }

    window.addEventListener('scroll', queueCamera, { passive: true });
    window.addEventListener('resize', queueMeasure, { passive: true });
    window.addEventListener('pageshow', queueMeasure);
    reducedMotion.addEventListener('change', queueMeasure);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(camera.frame);
        cancelAnimationFrame(camera.measureFrame);
        camera.frame = camera.measureFrame = 0;
      } else queueMeasure();
    });
    document.addEventListener('travesia:opened', queueMeasure);
    document.fonts?.ready.then(queueMeasure);
    for(const photo of document.querySelectorAll('.memory-photo img'))photo.addEventListener('load',queueMeasure,{once:true});
    const sceneVisibility = new IntersectionObserver(entries => {
      for (const entry of entries) chart.classList.toggle('scene-active', entry.isIntersecting);
    }, { rootMargin: '160px' });
    sceneVisibility.observe(chart);
    measureCamera();
  };
})();
