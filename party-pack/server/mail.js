// Emails a player their rejoin code. Uses Resend when RESEND_API_KEY and MAIL_FROM are set;
// otherwise it does nothing and the code is only shown on screen (which always happens).
// The address is used once to send, then discarded: rooms store only a salted hash of it.

const enabled = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

async function sendRejoinCode(to, { name, room, pin, link }) {
  if (!enabled) return false;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5">
    <p>Hi ${escapeHtml(name)} 🎉</p>
    <p>If you get disconnected, rejoin room <b>${room}</b> with this code:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:6px">${pin}</p>
    <p><a href="${link}">Open the game</a></p></div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject: `Your rejoin code for room ${room}: ${pin}`, html }),
  });
  if (!res.ok) throw new Error('email failed: ' + res.status);
  return true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { mailEnabled: enabled, sendRejoinCode };
