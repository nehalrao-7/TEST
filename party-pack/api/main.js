// Vercel serverless entry point: every /api/* request is rewritten here (see vercel.json).
const { handle } = require('../server/core');
const { getStore } = require('../server/stores');

module.exports = async (req, res) => {
  const { p, ...query } = req.query || {};
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const out = await handle(getStore(), req.method, p, body, query);
  res.statusCode = out.status || 200;
  res.setHeader('Cache-Control', out.svg ? 'public, max-age=3600' : 'no-store');
  if (out.svg) { res.setHeader('Content-Type', 'image/svg+xml'); res.end(out.svg); }
  else if (out.text) { res.setHeader('Content-Type', 'text/plain'); res.end(out.text); }
  else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out.json)); }
};
