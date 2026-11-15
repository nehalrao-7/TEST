// Parse a YouTube link (watch, youtu.be, shorts, embed, live, music) and its timestamp.
// Works in Node and in the browser (window.parseYouTube).
(function (root) {
  function toSeconds(v) {
    if (v == null || v === '') return null;
    v = String(v).trim();
    if (/^\d+(\.\d+)?$/.test(v)) return Math.floor(Number(v));
    if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(v)) return v.split(':').reduce((a, x) => a * 60 + Number(x), 0);
    const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
    if (m && (m[1] || m[2] || m[3])) return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
    return null;
  }
  function parseYouTube(link, clipSeconds) {
    if (!link) return null;
    let url;
    try { url = new URL(String(link).trim().replace(/^(?!https?:\/\/)/, 'https://')); } catch { return null; }
    const host = url.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
      id = url.searchParams.get('v');
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (!id && m) id = m[2];
    }
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const start = toSeconds(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hash.get('t')) || 0;
    let end = toSeconds(url.searchParams.get('end'));
    const clip = Number(clipSeconds);
    if (clip > 0) end = start + clip;
    return { videoId: id, start, end: end && end > start ? end : null };
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const api = { parseYouTube, toSeconds, fmtTime: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
