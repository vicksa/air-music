import test from 'node:test';
import assert from 'node:assert/strict';
import {GuitarTracker,handShape,localPoint,fretAt} from '../guitar.js';
import {Gestures} from '../engine.js';
const hand=(id,x,y)=>({id,cx:x,cy:y,points:Array.from({length:21},()=>({x,y}))});
function pinchHand(){const h=hand('Left',.75,.6);h.points[5]={x:.71,y:.59};h.points[17]={x:.79,y:.59};h.points[4]={x:.75,y:.5};h.points[8]={x:.76,y:.51};return h;}
test('Pinch detection uses hand proportions instead of camera distance',()=>{
 const h=pinchHand();assert.ok(handShape(h).pinch);
 const scaled={...h,points:h.points.map(p=>({x:p.x*.5,y:p.y*.5}))};assert.ok(handShape(scaled).pinch);
 h.points[8].x=.88;assert.equal(handShape(h).pinch,false);
});
test('Virtual guitar requires two separated hands and recalibrates after tracking loss',()=>{
 const tracker=new GuitarTracker();assert.equal(tracker.update([],640,480,0).ready,false);
 assert.equal(tracker.update([hand('Right',.2,.5)],640,480,0).ready,false);
 const frame=tracker.update([hand('Right',.2,.5),hand('Left',.8,.5)],640,480,40);
 assert.ok(frame.ready);assert.ok(frame.size>0);assert.equal(frame.strummer.id,'Left');
 tracker.update([],640,480,80);assert.equal(tracker.pose,null);
 assert.equal(tracker.update([hand('Right',.2,.5),hand('Left',.3,.5)],640,480,120).ready,false);
});
test('Frets map to the visible neck and keep instrument size while the selection hand moves',()=>{
 const tracker=new GuitarTracker();const a=tracker.update([hand('Right',.2,.5),hand('Left',.8,.5)],640,480,0);
 const b=tracker.update([hand('Right',.5,.5),hand('Left',.8,.5)],640,480,40);
 assert.equal(a.size,b.size);assert.ok(b.selectedNote>a.selectedNote);
 assert.equal(b.selectedNote,fretAt(b.tip.x));assert.ok(b.onNeck);
 assert.equal(fretAt(-2),0);assert.equal(fretAt(1),7);
});
test('Projection stays aligned when the guitar rotates',()=>{
 const p=localPoint({x:10,y:30},{x:10,y:10,angle:Math.PI/2,size:20});
 assert.ok(Math.abs(p.x-1)<1e-9);assert.ok(Math.abs(p.y)<1e-9);
});
test('Strings follow slowly, leaving space for a stroke instead of chasing the hand',()=>{
 const tracker=new GuitarTracker();tracker.update([hand('R',.2,.5),hand('L',.8,.5)],640,480,0);
 const moved=tracker.update([hand('R',.2,.5),hand('L',.8,.65)],640,480,40);
 assert.ok(moved.y<.55*480);assert.ok(moved.distance>.10);
});
test('Moving string line uses selected visible fret, and missing neck contact prevents playing',()=>{
 const g=new Gestures(),left=hand('R',.2,.5),right=hand('L',.8,.5);
 const pose=d=>({ready:true,onNeck:true,selector:left,strummer:right,selectedNote:5,style:'pinch',distance:d});
 assert.deepEqual(g.process([left,right],'guitar',1000,24,pose(-.08)),[]);
 assert.deepEqual(g.process([left,right],'guitar',1040,24,pose(.08)),[5]);
 assert.deepEqual(g.process([left,right],'guitar',1080,24,pose(.10)),[]);
 assert.deepEqual(g.process([left,right],'guitar',1250,24,{...pose(-.08),onNeck:false}),[]);
});
test('Changing hand shape or entering camera cannot accidentally trigger a strum',()=>{
 const g=new Gestures(),left=hand('R',.2,.5),right=hand('L',.8,.5);
 const pose=(d,style)=>({ready:true,onNeck:true,selector:left,strummer:right,selectedNote:2,style,distance:d});
 assert.deepEqual(g.process([left,right],'guitar',1000,24,pose(0,'palm')),[]);
 assert.deepEqual(g.process([left,right],'guitar',1040,24,pose(.08,'palm')),[]);
 assert.deepEqual(g.process([left,right],'guitar',1080,24,pose(-.08,'pinch')),[]);
});

test('Fingertip outside the visible neck is not treated as fret contact',()=>{
 const tracker=new GuitarTracker(),left=hand('R',.2,.5),right=hand('L',.8,.5);
 left.points[8]={x:.97,y:.5};
 assert.equal(tracker.update([left,right],640,480,0).onNeck,false);
});
