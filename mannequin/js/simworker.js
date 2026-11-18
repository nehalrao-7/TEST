// Runs the cloth solver off the main thread; posts particle positions every frame.
import { simFromState } from './sim.js';

let sim = null, running = false, params = {}, token = 0;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') { sim = simFromState(m.state); params = m.params; token = m.token; running = true; loop(token); }
  else if (m.type === 'stop') running = false;
  else if (m.type === 'resume' && sim) { running = true; if (sim.frame >= params.maxFrames) sim.frame = 0; loop(token); }
};
function loop(t) {
  if (!running || t !== token || !sim) return;
  sim.step(params);
  const done = sim.frame >= params.maxFrames || (sim.frame > 40 && sim.motion < params.rest);
  self.postMessage({ type: 'frame', token: t, X: sim.X.slice(), frame: sim.frame, motion: sim.motion, done });
  if (done) { running = false; return; }
  setTimeout(() => loop(t), 0);
}
