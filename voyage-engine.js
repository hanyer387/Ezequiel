/* Shared, deterministic route timing. No timers, inertia or scroll interception. */
(function(root){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
 function stateAt(y,m){
  if(!(m.start<m.arrival&&m.arrival<m.readingEnd&&m.readingEnd<m.end))throw new Error('Invalid voyage boundaries');
  const approach=clamp((y-m.start)/(m.arrival-m.start));
  const reading=clamp((y-m.arrival)/(m.readingEnd-m.arrival));
  const departure=clamp((y-m.readingEnd)/(m.end-m.readingEnd));
  const phase=y<m.arrival?'sailing':y<m.readingEnd?'reading':y<m.end?'departing':'horizon';
  const focus=phase==='reading'?ease((y-m.arrival)/Math.max(1,m.vh*.45)):phase==='departing'?1-ease(departure/.4):0;
  return {phase,approach:ease(approach),reading,departure:ease(departure),focus,
   boatLeg:y<m.readingEnd?'inbound':'outbound',
   boatProgress:y<m.arrival?ease(approach):y<m.readingEnd?1:ease(departure),
   total:clamp((y-m.start)/(m.end-m.start))};
 }
 const mixHeading=(a,b,t)=>a+(((b-a+540)%360)-180)*ease(t);
 // Framing is separate from route timing: the camera settles BEFORE reading.
 function framingAt(y,m,view){
  const s=stateAt(y,m),mobile=view.width<=700;
  const focus=y<m.readingEnd?ease((y-m.arrival+m.vh*.65)/Math.max(1,m.vh*.65)):1-ease((y-m.readingEnd)/Math.max(1,(m.end-m.readingEnd)*.5));
  const tilt=52-s.approach*32-focus*7;
  const desired=(mobile?.72:.67)+s.approach*.28+focus*(mobile?.25:.43);
  const boardHeight=view.boardHeight||Math.min(1040,view.width*.86)*.62;
  // Leave room for fixed navigation on short/landscape screens.
  const subjectHeight=boardHeight*(1-focus*.32);
  const fit=Math.max(.25,(view.height-160)/(subjectHeight*Math.cos(tilt*Math.PI/180)*1.1));
  return {focus,scale:Math.min(desired,fit),tilt,roll:-10+s.approach*8+focus,
   x:mobile?0:-view.width*.225*focus,
   y:(mobile?85:125)-s.approach*(mobile?75:115)-focus*12,
   z:-145+s.approach*195+focus*12,
   opacity:mobile?1-focus*.66:1};
 }
 // Matched endpoint tangents: no turn in place when leaving the pier.
 function routeAt(from,dock,next){
  const tangent={x:65,y:-8};
  return {
   inbound:`M${from.x} ${from.y} C${from.x+75} ${from.y+100} ${from.x+45} ${dock.y+85} ${dock.x-125} ${dock.y+65} S${dock.x-tangent.x} ${dock.y-tangent.y} ${dock.x} ${dock.y}`,
   outbound:`M${dock.x} ${dock.y} C${dock.x+tangent.x} ${dock.y+tangent.y} ${next.x-100} ${next.y+40} ${next.x} ${next.y}`
  };
 }
 // Multiple memories reuse the original voyage when there is only one stop.
 function journeyAt(y,m){
  const stops=m.stops;
  if(!stops?.length)throw new Error('Missing voyage stops');
  let previous=m.start;
  for(const stop of stops){
   if(!(previous<stop.arrival&&stop.arrival<stop.readingEnd))throw new Error('Invalid stop boundaries');
   previous=stop.readingEnd;
  }
  if(!(previous<m.end))throw new Error('Invalid horizon');
  const base=stateAt(y,{...m,arrival:stops[0].arrival,readingEnd:previous});
  for(let i=0;i<stops.length;i++){
   const stop=stops[i],start=i?stops[i-1].readingEnd:m.start;
   if(y<stop.arrival)return {...base,phase:'sailing',stopIndex:i,routeIndex:i,boatProgress:ease((y-start)/(stop.arrival-start)),reading:0};
   if(y<stop.readingEnd)return {...base,phase:'reading',stopIndex:i,routeIndex:i,boatProgress:1,reading:clamp((y-stop.arrival)/(stop.readingEnd-stop.arrival))};
  }
  return {...base,stopIndex:stops.length-1,routeIndex:stops.length,boatProgress:ease((y-previous)/(m.end-previous)),reading:1};
 }
 function journeyFramingAt(y,m,view){
  const state=journeyAt(y,m),stops=m.stops;
  const frame=framingAt(y,{...m,arrival:stops[0].arrival,readingEnd:stops.at(-1).readingEnd},view);
  const current=stops[state.stopIndex],previous=stops[Math.max(0,state.stopIndex-1)];
  const traveling=state.phase==='sailing'&&state.stopIndex>0;
  const p=traveling?state.boatProgress:1;
  const x=previous.x+(current.x-previous.x)*p,yTarget=previous.y+(current.y-previous.y)*p;
  const pullback=traveling?Math.sin(p*Math.PI):0;
  const scale=frame.scale*(1-.14*pullback);
  const focus=frame.focus*(1-.7*pullback);
  return {...frame,focus,scale,tilt:frame.tilt+9*pullback,opacity:frame.opacity+(1-frame.opacity)*pullback,
   x:frame.x*(1-.45*pullback)-(x-.5)*(view.boardWidth||view.width*.8)*scale*focus,
   y:frame.y-(yTarget-.5)*view.boardHeight*scale*.75*focus};
 }
 function passageAt(from,to,startTangent,endTangent,via=[]){
  const points=[from,...via,to];
  const tangents=points.map((p,i)=>i===0?startTangent:i===points.length-1?endTangent:{x:(points[i+1].x-points[i-1].x)/6,y:(points[i+1].y-points[i-1].y)/6});
  return `M${from.x} ${from.y}`+points.slice(1).map((b,i)=>{
   const a=points[i],ta=tangents[i],tb=tangents[i+1];
   return ` C${a.x+ta.x} ${a.y+ta.y} ${b.x-tb.x} ${b.y-tb.y} ${b.x} ${b.y}`;
  }).join('');
 }
 const api={stateAt,clamp,ease,mixHeading,framingAt,routeAt,journeyAt,journeyFramingAt,passageAt};
 root.VoyageEngine=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
