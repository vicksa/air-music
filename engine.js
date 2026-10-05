export const NOTES = ['DÓ','RÉ','MI','FÁ','SOL','LÁ','SI','DÓ'];
export const FREQUENCIES = [261.63,293.66,329.63,349.23,392,440,493.88,523.25];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const displayX = (rawX, mirror = true) => mirror ? 1 - rawX : rawX;
export function noteAt(screenX, left = 0, right = 1) {
  return clamp(Math.floor((screenX - left) / (right - left) * 8), 0, 7);
}
export function projectHands(result, mirror = true) {
  return result.landmarks.map((points, i) => ({
    id: result.handednesses?.[i]?.[0]?.categoryName || String(i),
    points: points.map(p => ({ ...p, x: displayX(p.x, mirror) })),
    cx: points.reduce((sum,p) => sum + displayX(p.x,mirror), 0) / points.length,
    cy: points.reduce((sum,p) => sum + p.y, 0) / points.length,
  }));
}
export class Gestures {
  constructor() { this.reset(); }
  reset() { this.previous = new Map(); this.strum = null; }
  process(hands, mode, now, sensitivity = 24, guitarPose = null) {
    const notes = [];
    const threshold = .10 + (45 - sensitivity) * .008;
    if (mode === 'piano') {
      const seen = new Set();
      for (const hand of hands) {
        seen.add(hand.id);
        const tip = hand.points[8];
        const old = this.previous.get(hand.id);
        const state = { y: tip.y, time: now, armed: old?.armed ?? true, played: old?.played ?? -Infinity };
        if (old && now - old.time < 180 && now > old.time) {
          const speed = (tip.y - old.y) / ((now - old.time) / 1000);
          if (speed < -threshold * .35) state.armed = true;
          if (tip.y > .30 && tip.y < .94 && speed > threshold && state.armed && now - state.played > 160) {
            notes.push(noteAt(tip.x)); state.armed = false; state.played = now;
          }
        }
        this.previous.set(hand.id, state);
      }
      for (const id of this.previous.keys()) if (!seen.has(id)) this.previous.delete(id);
    } else {
      const ordered = [...hands].sort((a,b) => a.cx - b.cx);
      const selector = guitarPose?.selector || ordered[0], strummer = guitarPose?.strummer || ordered.at(-1);
      if (hands.length < 2 || (guitarPose ? !guitarPose.ready || !guitarPose.onNeck : selector.cx >= .5 || strummer.cx <= .5)) { this.strum = null; return notes; }
      const position=guitarPose ? guitarPose.distance : strummer.cy-.58;
      const style=guitarPose?.style || 'fixed';
      const old = this.strum;
      const side=Math.abs(position)>.012?Math.sign(position):0;
      const state = { y: position, id: strummer.id, style, side:side || (old?.style===style&&old?.id===strummer.id?old.side:0) || 0, time: now, played: old?.played ?? -Infinity };
      if (old && old.id === strummer.id && old.style === style && now > old.time && now - old.time < 180) {
        const speed = Math.abs(position - old.y) / ((now - old.time) / 1000);
        const crossing = guitarPose ? side && old.side && side!==old.side : (old.y < 0 && position >= 0) || (old.y > 0 && position <= 0);
        if (crossing && speed > threshold * .55 && now - state.played > 160) {
          notes.push(guitarPose ? guitarPose.selectedNote : noteAt(selector.points[8].x, .06, .47)); state.played = now;
        }
      }
      this.strum = state;
    }
    return notes;
  }
}
// Karplus–Strong: an excited string loses its highest harmonics as it rings.
export function pluckedString(frequency, sampleRate, duration = 2.8, seed = 7351) {
  const period = Math.max(2, Math.round(sampleRate / frequency - .5));
  const ring = new Float32Array(period), output = new Float32Array(Math.ceil(sampleRate * duration));
  let random = seed >>> 0;
  for (let i = 0; i < period; i++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    ring[i] = ((random / 4294967296) * 2 - 1) * .45 + Math.sin(2 * Math.PI * i / period) * .25;
  }
  const average = ring.reduce((sum,n) => sum+n,0) / period;
  for (let i = 0; i < period; i++) ring[i] -= average;
  for (let i = 0; i < output.length; i++) {
    const j = i % period;
    output[i] = ring[j];
    ring[j] = .997 * (ring[j] + ring[(j+1) % period]) * .5;
  }
  return output;
}
export class Instruments {
  constructor(context) {
    this.context = context; this.voices = new Set();
    this.master = context.createGain(); this.master.gain.value = .6;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -15; limiter.knee.value = 12; limiter.ratio.value = 5;
    this.master.connect(limiter); limiter.connect(context.destination);
  }
  volume(value) { this.master.gain.setTargetAtTime(value, this.context.currentTime, .03); }
  play(index, instrument, when = this.context.currentTime) {
    const ctx = this.context, envelope = ctx.createGain(); let source;
    if (instrument === 'guitar') {
      source = ctx.createBufferSource();
      const samples = pluckedString(FREQUENCIES[index] / 2, ctx.sampleRate, 2.8, 7351 + index);
      source.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      source.buffer.copyToChannel(samples, 0);
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 180; body.Q.value = .8; body.gain.value = 3;
      const warmth = ctx.createBiquadFilter(); warmth.type = 'lowpass'; warmth.frequency.value = 4200; warmth.Q.value = .6;
      source.connect(body); body.connect(warmth); warmth.connect(envelope);
      envelope.gain.setValueAtTime(0, when); envelope.gain.linearRampToValueAtTime(.85,when+.003);
      envelope.gain.exponentialRampToValueAtTime(.001,when+2.75);
      source.start(when); source.stop(when+2.8);
    } else {
      source = ctx.createOscillator(); source.frequency.value = FREQUENCIES[index]; source.type = 'triangle';
      source.connect(envelope); envelope.gain.setValueAtTime(0,when); envelope.gain.linearRampToValueAtTime(.28,when+.006);
      envelope.gain.exponentialRampToValueAtTime(.001,when+.9); source.start(when); source.stop(when+1);
    }
    envelope.connect(this.master); this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); envelope.disconnect(); };
  }
  stop() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
}
