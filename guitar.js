import {clamp, NOTES} from './engine.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function handShape(hand) {
  const p=hand.points, width=distance(p[5],p[17]);
  const pinch=width>.005&&distance(p[4],p[8])/width<.55;
  const curled=[8,12,16,20].filter((tip,i)=>distance(p[tip],p[0])<distance(p[[6,10,14,18][i]],p[0])*1.1).length;
  return {pinch,grip:curled>=2};
}
export function fretAt(localX) { return clamp(Math.floor((localX+.98)/.70*8),0,7); }
export function localPoint(point,pose) {
  const dx=point.x-pose.x,dy=point.y-pose.y,c=Math.cos(pose.angle),s=Math.sin(pose.angle);
  return {x:(dx*c+dy*s)/pose.size,y:(-dx*s+dy*c)/pose.size};
}
export class GuitarTracker {
  constructor(){this.reset();}
  reset(){this.pose=null;this.lastTime=null;}
  update(hands,width,height,time) {
    const sorted=[...hands].sort((a,b)=>a.cx-b.cx),left=sorted[0],right=sorted.at(-1);
    if(hands.length<2||right.cx-left.cx<.16){this.reset();return {ready:false};}
    const shape=handShape(right),leftShape=handShape(left);
    const strum=shape.pinch?{x:(right.points[4].x+right.points[8].x)/2,y:(right.points[4].y+right.points[8].y)/2}:{x:right.cx,y:right.cy};
    const grip={x:(left.points[0].x+left.points[9].x)/2*width,y:(left.points[0].y+left.points[9].y)/2*height};
    const target={x:strum.x*width,y:strum.y*height};
    const angle=clamp(Math.atan2(target.y-grip.y,target.x-grip.x),-.45,.45);
    const style=shape.pinch?'pinch':'palm';
    if(!this.pose||this.pose.style!==style||time-this.lastTime>220){
      this.pose={...target,angle,size:clamp(distance(target,grip)*1.10,width*.32,width*.59),style};
    }else{
      // Follow the resting position slowly, so the strings do not chase a strum.
      const follow=1-Math.exp(-Math.max(0,time-this.lastTime)/900);
      this.pose.x+=(target.x-this.pose.x)*follow;this.pose.y+=(target.y-this.pose.y)*follow;
      this.pose.angle+=(angle-this.pose.angle)*follow;
    }
    this.lastTime=time;
    const tip=localPoint({x:left.points[8].x*width,y:left.points[8].y*height},this.pose);
    const pluck=localPoint(target,this.pose);
    return {...this.pose,ready:true,selector:left,strummer:right,selectedNote:fretAt(tip.x),onNeck:Math.abs(tip.y)<.28&&tip.x> -1.20&&tip.x< -.18,
      distance:pluck.y*this.pose.size/height,pinched:shape.pinch,gripped:leftShape.grip,tip,pluck};
  }
}
export function drawGuitar(ctx,pose,width,height,time=0,lastHit=-Infinity,playedNote=0) {
  const live=pose?.ready;
  const frame=live?pose:{x:width*.75,y:height*.60,size:width*.51,angle:0,selectedNote:0};
  const s=frame.size,glow=Math.max(0,1-(time-lastHit)/230);
  ctx.save();ctx.translate(frame.x,frame.y);ctx.rotate(frame.angle);ctx.scale(s,s);
  ctx.globalAlpha=live?.88:.40;
  const wood=ctx.createLinearGradient(-.32,-.3,.3,.3);wood.addColorStop(0,'#bf7948');wood.addColorStop(.5,'#713b2d');wood.addColorStop(1,'#dc9b5e');
  ctx.fillStyle=wood;ctx.strokeStyle=live?'#f2bf84':'#8e786a';ctx.lineWidth=.010;
  ctx.beginPath();ctx.moveTo(-.28,-.11);ctx.bezierCurveTo(-.43,-.30,-.24,-.34,-.13,-.19);ctx.bezierCurveTo(-.02,-.15,.04,-.34,.17,-.25);ctx.bezierCurveTo(.34,-.12,.32,.16,.17,.28);ctx.bezierCurveTo(.03,.38,-.09,.21,-.2,.16);ctx.bezierCurveTo(-.43,.31,-.43,.07,-.28,.08);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#33251e';ctx.fillRect(-.99,-.065,.75,.13);ctx.strokeStyle='#d59a68';ctx.strokeRect(-.99,-.065,.75,.13);
  ctx.fillStyle='#ad6939';ctx.beginPath();ctx.moveTo(-.99,-.062);ctx.lineTo(-1.20,-.10);ctx.lineTo(-1.24,.065);ctx.lineTo(-.99,.065);ctx.closePath();ctx.fill();ctx.stroke();
  for(let i=0;i<6;i++){ctx.fillStyle='#ced7de';ctx.fillRect(-1.19+(i%3)*.055,i<3?-.12:.07,.027,.033);}
  const fretWidth=.70/8;
  ctx.fillStyle=glow>0&&playedNote===frame.selectedNote?'#ffd76acc':'#76e0c599';
  if(live)ctx.fillRect(-.98+frame.selectedNote*fretWidth,-.064,fretWidth,.128);
  for(let i=0;i<=8;i++){const x=-.98+i*fretWidth;ctx.strokeStyle='#c7c3b4';ctx.lineWidth=.004;ctx.beginPath();ctx.moveTo(x,-.064);ctx.lineTo(x,.064);ctx.stroke();}
  ctx.fillStyle='#171c28';ctx.fillRect(-.10,-.076,.042,.152);ctx.fillRect(.03,-.076,.042,.152);
  ctx.fillStyle='#d0c1a2';ctx.fillRect(.17,-.058,.038,.116);
  // Six strings visibly vibrate when the instrument sounds.
  for(let i=0;i<6;i++){
    const y=(i-2.5)*.014;ctx.strokeStyle=glow>0?'#ffd76a':'#e9dfc2';ctx.lineWidth=(.002+i*.00035)*(1+glow);
    ctx.beginPath();ctx.moveTo(-1.19,y);
    for(let j=0;j<=35;j++){const x=-1.19+j*(1.39/35),vibration=Math.sin(j*.9+time*.07)*.009*glow*Math.sin(j/35*Math.PI);ctx.lineTo(x,y+vibration);}
    ctx.stroke();
  }
  ctx.strokeStyle='#ffd76a';ctx.lineWidth=.006;ctx.setLineDash([.02,.015]);
  ctx.beginPath();ctx.moveTo(-.18,0);ctx.lineTo(.19,0);ctx.stroke();ctx.setLineDash([]);
  ctx.globalAlpha=1;ctx.font='bold .065px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='#fff3d7';
  if(live)ctx.fillText(NOTES[frame.selectedNote],-.98+(frame.selectedNote+.5)*fretWidth,-.10);
  ctx.restore();
  if(live){
    const radius=Math.max(7,width*.018);ctx.strokeStyle=pose.pinched?'#76e0c5':'#ffd76a';ctx.lineWidth=2;
    const px=pose.strummer.points,center=pose.pinched?{x:(px[4].x+px[8].x)/2,y:(px[4].y+px[8].y)/2}:{x:pose.strummer.cx,y:pose.strummer.cy};
    ctx.beginPath();ctx.arc(center.x*width,center.y*height,radius,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=pose.gripped&&pose.onNeck?'#76e0c5':'#ffd76a';const finger=pose.selector.points[8];
    ctx.beginPath();ctx.arc(finger.x*width,finger.y*height,radius*.8,0,Math.PI*2);ctx.stroke();
  }
}
