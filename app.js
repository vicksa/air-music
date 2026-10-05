import {NOTES, noteAt, projectHands, Gestures, Instruments} from './engine.js';
import {GuitarTracker, drawGuitar} from './guitar.js';
const $ = selector => document.querySelector(selector);
const video=$('#video'), canvas=$('#canvas'), ctx=canvas.getContext('2d'), status=$('#status');
const native = location.hostname === 'appassets.androidplatform.net';
let mode='piano', mirror=true, detector=null, audio=null, instruments=null, frame=0, lastVideo=-1, generation=0;
let challenge=false,target=0,score=0,combo=0,demoGeneration=0;
const gestures=new Gestures();
const guitarTracker=new GuitarTracker();
let guitarPose={ready:false},lastGuitarHit=-Infinity,playedGuitarNote=0;
canvas.width=640;canvas.height=480;
for (const [i,note] of NOTES.entries()) for (const [container, className] of [['#keys','key'],['#frets','fret']]) {
  const button=document.createElement('button'); button.className=className; button.dataset.i=i;
  button.textContent=note; button.setAttribute('aria-label',`${note}, nota ${i+1}`);
  button.addEventListener('click',async()=>{try {await ensureAudio();play(i);}catch(error){status.textContent='Não foi possível iniciar o som';}});
  $(container).append(button);
}
async function ensureAudio() {
  if (!audio) { const Audio=window.AudioContext||window.webkitAudioContext;audio=new Audio();instruments=new Instruments(audio); }
  await audio.resume(); instruments.volume(Number($('#volume').value)/100);
}
function play(i) {
  instruments.play(i,mode);
  if(mode==='guitar'){lastGuitarHit=performance.now();playedGuitarNote=i;if(!detector)draw([],lastGuitarHit);}
  const key=$(mode==='piano'?`.key[data-i="${i}"]`:`.fret[data-i="${i}"]`);
  key.classList.add('hit');setTimeout(()=>key.classList.remove('hit'),160);
  if(challenge){if(i===target){score+=100*++combo;target=Math.floor(Math.random()*8);}else combo=0;challengeUI();}
}
function challengeUI(){ $('#challengeUI').innerHTML=challenge?`Toque: <span class="target">${NOTES[target]}</span> · Pontos ${score} · Combo ×${combo}`:'Modo livre'; }
function selectMode(next){
  mode=next; gestures.reset();guitarTracker.reset();guitarPose={ready:false};lastGuitarHit=-Infinity; demoGeneration++; instruments?.stop();
  for(const button of document.querySelectorAll('[data-mode]')){const active=button.dataset.mode===mode;button.classList.toggle('on',active);button.setAttribute('aria-pressed',active);}
  for (const id of ['keys','pianoLesson','pianoGhost']) $('#'+id).hidden=mode!=='piano';
  for (const id of ['guitar','guitarLesson','guitarGhost','recenter']) $('#'+id).hidden=mode!=='guitar';
  $('#demo').textContent=mode==='guitar'?'Ouvir guitarra':'Ouvir piano';
  $('#screenLabels').innerHTML=mode==='piano'?'<span>← Notas graves</span><span>Notas agudas →</span>':'<span>Escolher nota</span><span>Palhetar ↕</span>';
  $('#feedback').textContent=mode==='piano'?'Desça para tocar e levante para preparar a próxima nota.':'Segure o braço da guitarra com a mão à esquerda da tela. Faça a palhetada sobre o corpo da guitarra.';
  draw([],performance.now());
}
$('#recenter').onclick=()=>{guitarTracker.reset();gestures.reset();guitarPose={ready:false};lastGuitarHit=-Infinity;draw([],performance.now());$('#feedback').textContent='Mostre as duas mãos na posição confortável para reposicionar a guitarra.';};
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>selectMode(button.dataset.mode));
$('#challenge').onclick=()=>{challenge=!challenge;score=combo=0;target=Math.floor(Math.random()*8);$('#challenge').setAttribute('aria-pressed',challenge);challengeUI();};
$('#volume').oninput=()=>instruments?.volume(Number($('#volume').value)/100);
$('#mirror').onclick=()=>{mirror=!mirror;video.style.transform=mirror?'scaleX(-1)':'none';$('#mirror').textContent=`Espelho: ${mirror?'ligado':'desligado'}`;$('#mirror').setAttribute('aria-pressed',mirror);gestures.reset();guitarTracker.reset();guitarPose={ready:false};draw([],performance.now());};
$('#demo').onclick=async()=>{
  try {await ensureAudio();demoGeneration++;const token=demoGeneration;instruments.stop();
    for(const [step,note] of [0,2,4,7,4,2,0].entries()) setTimeout(()=>{if(token===demoGeneration)play(note);},step*330);
  } catch {status.textContent='Não foi possível iniciar o som. Toque novamente.';}
};
function stopCamera(){
  generation++;cancelAnimationFrame(frame);frame=0;
  video.srcObject?.getTracks().forEach(track=>track.stop());video.srcObject=null;
  detector?.close();detector=null;gestures.reset();guitarTracker.reset();guitarPose={ready:false};lastVideo=-1;lastGuitarHit=-Infinity;
  ctx.clearRect(0,0,canvas.width,canvas.height);$('#start').disabled=false;$('#stop').disabled=true;
  draw([],performance.now());$('#guitarGhost').hidden=mode!=='guitar';document.querySelectorAll('.fret.selected').forEach(key=>key.classList.remove('selected'));status.textContent='Câmera desligada';$('#pianoGhost .ghost').classList.remove('active');$('#noteGhost').classList.remove('active');$('#strumGhost').classList.remove('active');
}
window.stopAirMusic=()=>{stopCamera();demoGeneration++;instruments?.stop();};
window.pauseAirMusic=()=>{if(video.srcObject)window.stopAirMusic();};
$('#stop').onclick=window.stopAirMusic;
if(!native)document.addEventListener('visibilitychange',()=>{if(document.hidden)window.stopAirMusic();});
$('#start').onclick=async()=>{
  if($('#start').disabled)return;
  $('#start').disabled=true;status.textContent='Carregando reconhecimento das mãos…';const token=++generation;
  let pendingDetector=null,pendingStream=null;
  try{
    await ensureAudio();
    const {HandLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm');
    const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
    pendingDetector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minTrackingConfidence:.5});
    if(token!==generation){pendingDetector.close();return;}
    status.textContent='Permita a câmera para começar';
    pendingStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    if(token!==generation){pendingStream.getTracks().forEach(track=>track.stop());pendingDetector.close();return;}
    video.srcObject=pendingStream;await video.play();
    if(token!==generation){pendingStream.getTracks().forEach(track=>track.stop());pendingDetector.close();return;}
    detector=pendingDetector;pendingDetector=null;pendingStream=null;
    $('#stage').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;lastVideo=-1;$('#stop').disabled=false;
    frame=requestAnimationFrame(loop);
  }catch(error){pendingStream?.getTracks().forEach(track=>track.stop());pendingDetector?.close();if(token!==generation)return;stopCamera();status.textContent=error.name==='NotAllowedError'?'Permissão da câmera negada. Libere nas configurações e tente de novo.':'Não foi possível ativar a câmera. Confira a internet e tente de novo.';}
};
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function draw(hands,time=performance.now()){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  if(mode==='guitar')drawGuitar(ctx,guitarPose,w,h,time,lastGuitarHit,playedGuitarNote);
  for(const hand of hands){ctx.strokeStyle='#76e0c5';ctx.fillStyle='#76e0c5';ctx.lineWidth=2;
    for(const[a,b]of connections){ctx.beginPath();ctx.moveTo(hand.points[a].x*w,hand.points[a].y*h);ctx.lineTo(hand.points[b].x*w,hand.points[b].y*h);ctx.stroke();}
    for(const[p,i]of hand.points.map((p,i)=>[p,i])){ctx.beginPath();ctx.arc(p.x*w,p.y*h,i===8?6:3,0,Math.PI*2);ctx.fill();}
  }
}
function guide(hands){
  $('#pianoGhost .ghost').classList.toggle('active',hands.length>0);
  const left=guitarPose.ready?guitarPose.selector:hands.find(h=>h.cx<.5),right=guitarPose.ready?guitarPose.strummer:hands.find(h=>h.cx>.5);
  $('#guitarGhost').hidden=mode!=='guitar'||guitarPose.ready;$('#noteGhost').classList.toggle('active',!!left);$('#strumGhost').classList.toggle('active',!!right);
  document.querySelectorAll('.fret.selected').forEach(key=>key.classList.remove('selected'));
  if(mode==='guitar'&&left)$(`.fret[data-i="${guitarPose.ready?guitarPose.selectedNote:noteAt(left.points[8].x,.06,.47)}"]`).classList.add('selected');
  status.textContent=mode==='piano'?(hands.length?`${hands.length} mão(s) · desça o indicador para tocar`:'Mostre a mão inteira para a câmera'):(!guitarPose.ready?'Afaste as mãos: uma no braço, outra no corpo da guitarra':!guitarPose.onNeck?'Aproxime o indicador do braço da guitarra':guitarPose.pinched?(guitarPose.gripped?'Pegada e palheta reconhecidas · toque as cordas':'Palheta reconhecida · toque as cordas'): 'Junte polegar e indicador sobre as cordas');
}
function loop(time){
  if(!detector)return;
  if(video.readyState>=2&&video.currentTime!==lastVideo){
    lastVideo=video.currentTime;
    try{const hands=projectHands(detector.detectForVideo(video,time),mirror);
      if(mode==='guitar')guitarPose=guitarTracker.update(hands,canvas.width,canvas.height,time);
      for(const note of gestures.process(hands,mode,time,Number($('#sens').value),mode==='guitar'?guitarPose:null))play(note);
      draw(hands,time);guide(hands);
    }catch{stopCamera();status.textContent='O reconhecimento foi interrompido. Toque em Ativar câmera para reiniciar.';return;}
  }
  frame=requestAnimationFrame(loop);
}
selectMode('piano');
if(native){$('#installHint').hidden=true;}
else{
  let installPrompt;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install').hidden=false;});
  $('#install').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;};
  window.addEventListener('appinstalled',()=>{$('#install').hidden=true;$('#installHint').hidden=true;});
  if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('#installHint').hidden=true;
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
