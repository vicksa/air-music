import test from 'node:test';
import assert from 'node:assert/strict';
import {displayX,noteAt,projectHands,Gestures,pluckedString} from '../engine.js';
const hand=(id,x,y)=>({id,cx:x,cy:y,points:Array.from({length:21},()=>({x,y}))});
test('Overlay and note use the same displayed horizontal position, with mirror on and off',()=>{
 const raw={landmarks:[hand('Left',.2,.6).points],handednesses:[[{categoryName:'Left'}]]};
 for(const mirror of [true,false]){
  const projected=projectHands(raw,mirror)[0];assert.equal(projected.points[8].x,displayX(.2,mirror));assert.ok(Math.abs(projected.cx-displayX(.2,mirror))<1e-12);
  assert.equal(noteAt(projected.points[8].x),mirror?6:1);
 }
 assert.equal(noteAt(0),0);assert.equal(noteAt(1),7);
});
test('Piano plays once per downward stroke and rearms after lifting',()=>{
 const gestures=new Gestures();assert.deepEqual(gestures.process([hand('Left',.15,.4)],'piano',1000),[]);
 assert.deepEqual(gestures.process([hand('Left',.15,.45)],'piano',1040),[1]);
 assert.deepEqual(gestures.process([hand('Left',.15,.5)],'piano',1080),[]);
 gestures.process([hand('Left',.15,.4)],'piano',1240);
 assert.deepEqual(gestures.process([hand('Left',.15,.5)],'piano',1280),[1]);
});
test('Missing hand or slow inference cannot create a phantom stroke',()=>{
 const gestures=new Gestures();gestures.process([hand('Left',.2,.3)],'piano',0);gestures.process([],'piano',40);
 assert.deepEqual(gestures.process([hand('Left',.2,.7)],'piano',80),[]);
 assert.deepEqual(gestures.process([hand('Left',.2,.9)],'piano',1000),[]);
});
test('Guitar selects the on-screen left hand independent of input order and strums across its line',()=>{
 const gestures=new Gestures();const left=hand('Right',.25,.45);
 assert.deepEqual(gestures.process([hand('Left',.8,.52),left],'guitar',1000),[]);
 assert.deepEqual(gestures.process([left,hand('Left',.8,.65)],'guitar',1040),[3]);
 assert.deepEqual(gestures.process([left,hand('Left',.8,.68)],'guitar',1080),[]);
 assert.deepEqual(gestures.process([left],'guitar',1200),[]);
 assert.deepEqual(gestures.process([left,hand('Left',.8,.4)],'guitar',1240),[]);
});
test('Both hands must be in separate screen halves to strum',()=>{
 const g=new Gestures();g.process([hand('Left',.2,.3),hand('Right',.3,.5)],'guitar',1000);
 assert.deepEqual(g.process([hand('Left',.2,.3),hand('Right',.3,.7)],'guitar',1050),[]);
});
test('Plucked guitar produces a finite, bounded, decaying signal at its requested pitch',()=>{
 const rate=48000,freq=130.815,data=pluckedString(freq,rate);
 assert.equal(data.length,134400);assert.ok(data.every(x=>Number.isFinite(x)&&Math.abs(x)<1));
 const rms=(a,b)=>Math.sqrt(data.slice(a,b).reduce((sum,x)=>sum+x*x,0)/(b-a));
 assert.ok(rms(48000,60000)<rms(0,12000)*.8);
 // Autocorrelation of the ringing string: strongest local peak near the target period.
 let best=0,bestLag=0;
 for(let lag=Math.floor(rate/freq)-4;lag<=Math.ceil(rate/freq)+4;lag++){
  let correlation=0;for(let i=3000;i<9000;i++)correlation+=data[i]*data[i+lag];
  if(correlation>best){best=correlation;bestLag=lag;}
 }
 assert.ok(Math.abs(rate/bestLag-freq)/freq<.02);
});
