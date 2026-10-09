// 간단한 효과음 (WebAudio). 기본값 꺼짐. 소리만으로 상태를 전달하지 않는다.
let ctx = null;
let enabled = false;

export function setSoundEnabled(v) { enabled = !!v; if (enabled) ensure(); }
export function isSoundEnabled() { return enabled; }

function ensure() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(freq, dur = 0.12, type = 'sine', gain = 0.08, when = 0) {
  if (!enabled) return;
  ensure();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime + when;
  o.start(t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  select() { tone(660, 0.08); },
  ok() { tone(523, 0.1); tone(784, 0.14, 'sine', 0.08, 0.1); },
  no() { tone(240, 0.15, 'triangle', 0.05); },
  flip() { tone(440, 0.06, 'triangle', 0.05); },
  done() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.08, i * 0.12)); },
  clue() { tone(880, 0.12); tone(1174, 0.2, 'sine', 0.08, 0.12); },
};
