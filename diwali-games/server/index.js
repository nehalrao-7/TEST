// Local development server: serves public/ and the same /api routes as the Vercel function.
// Without SUPABASE_* env vars it stores state in ./data and clients poll for updates.

const path = require('path');
const express = require('express');
const { handle } = require('./core');
const { getStore } = require('./stores');

const app = express();
app.use((req, res, next) => { res.set('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.all('/api/*', async (req, res) => {
  const out = await handle(getStore(), req.method, req.params[0], req.body, req.query);
  res.status(out.status || 200);
  if (out.svg) res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(out.svg);
  else if (out.text) res.type('text/plain').send(out.text);
  else res.json(out.json);
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n🪔  2026 Diwali Party on http://localhost:${PORT}  (players /play · host /host · TV /tv)\n`);
});
