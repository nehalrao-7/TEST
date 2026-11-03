// Sends OTP codes by SMS through Twilio when credentials are configured.
// Without credentials the app runs in "host relay" mode: codes appear on the
// host dashboard so the host can read them out to guests.

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM; // a Twilio number, e.g. +15551234567
const SERVICE = process.env.TWILIO_MESSAGING_SERVICE_SID; // optional alternative to FROM

const smsEnabled = Boolean(SID && TOKEN && (FROM || SERVICE));

async function sendSms(to, body) {
  if (!smsEnabled) return false;
  const params = new URLSearchParams({ To: to, Body: body });
  if (SERVICE) params.set('MessagingServiceSid', SERVICE);
  else params.set('From', FROM);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Twilio error ${res.status}: ${text.slice(0, 200)}`);
  }
  return true;
}

module.exports = { smsEnabled, sendSms };
