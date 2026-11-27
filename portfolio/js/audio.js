// =========================================================
// A generative soundscape — no audio files, all synthesis.
// Warm detuned pad + filtered wind + soft chimes on interaction.
// =========================================================
export function createAudio() {
  let ctx = null, master = null, on = false;
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // major pentatonic-ish, rooted on D
  const ROOT = 146.83;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    // simple feedback-delay "space"
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
    ctx.space = delay;

    // pad: three detuned voices through a slowly breathing low-pass
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.7;
    const padGain = ctx.createGain(); padGain.gain.value = 0.16;
    lp.connect(padGain).connect(master); padGain.connect(delay);
    [[ROOT / 2, "sawtooth", -7], [ROOT / 2, "sawtooth", 6], [ROOT * 0.75, "triangle", 0], [ROOT, "sine", 3]].forEach(([f, type, det]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = type === "sawtooth" ? 0.22 : 0.35;
      o.connect(g).connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 260;
    lfo.connect(lfoAmt).connect(lp.frequency); lfo.start();

    // wind: looped noise through a wandering band-pass
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0.22;
    noise.connect(bp).connect(windGain).connect(master); noise.start();
    const wl = ctx.createOscillator(); wl.frequency.value = 0.07;
    const wla = ctx.createGain(); wla.gain.value = 300;
    wl.connect(wla).connect(bp.frequency); wl.start();
  }

  function chime(step = 0, vel = 0.12, oct = 2) {
    if (!on || !ctx) return;
    const t = ctx.currentTime;
    const f = ROOT * oct * Math.pow(2, SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length] / 12);
    [1, 2.01].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel / (i + 1.5), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g); g.connect(master); g.connect(ctx.space);
      o.start(t); o.stop(t + 2.5);
    });
  }

  return {
    get on() { return on; },
    async toggle(force) {
      const next = force ?? !on;
      if (next && !ctx) build();
      if (!ctx) return on;
      if (ctx.state === "suspended") await ctx.resume();
      on = next;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(on ? 0.8 : 0, ctx.currentTime + (on ? 2.5 : 0.6));
      if (on) setTimeout(() => chime(4, 0.1), 300);
      return on;
    },
    hover(i) { chime(i, 0.05, 2); },
    select(i) { chime(i, 0.13, 2); setTimeout(() => chime(i + 2, 0.08, 2), 140); },
    note() { [0, 2, 4].forEach((s, k) => setTimeout(() => chime(s + 5, 0.08, 2), k * 110)); },
  };
}
