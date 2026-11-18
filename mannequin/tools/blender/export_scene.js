const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 60000 });
  const t0 = Date.now();
  await p.waitForFunction(() => window.__studio.sim && !window.__studio.simRunning, null, { timeout: 600000 });
  console.log('drape s', (Date.now() - t0) / 1000);
  const scene = await p.evaluate(() => window.__studio.exportScene());
  let n = 0;
  const save = (dataUrl, name) => { if (!dataUrl) return null; const f = name + '.png'; fs.writeFileSync(path.join(out, f), Buffer.from(dataUrl.split(',')[1], 'base64')); n++; return f; };
  for (const [k, m] of Object.entries(scene.materials)) if (m) { m.map = save(m.map, 'tex_' + k); m.normal = save(m.normal, 'nrm_' + k); }
  scene.proxies.forEach((pr) => { pr.texture = save(pr.texture, 'tex_' + pr.kind); });
  fs.copyFileSync(path.join('/home/user/TEST/mannequin', scene.skinTexture), path.join(out, 'skin.jpg')); scene.skinTexture = 'skin.jpg';
  fs.writeFileSync(path.join(out, 'scene.json'), JSON.stringify(scene));
  console.log('wrote', n, 'textures; garments', scene.garments.map((g) => `${g.part}:${g.pos.length / 3}`).join(' '), 'body verts', scene.body.pos.length / 3);
  await b.close();
})();
