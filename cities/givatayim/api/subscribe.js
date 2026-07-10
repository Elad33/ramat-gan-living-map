// Email-updates signup. Writes to Supabase with the service role key
// (kept in Vercel env vars; the table has RLS with no anon policies).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: 'not_configured' }); return; }

  let email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: 'invalid_email' });
    return;
  }
  const source = String((req.body && req.body.source) || 'map-popup').slice(0, 40);

  try {
    const r = await fetch(url.replace(/\/$/, '') + '/rest/v1/subscribers', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates', // resubscribing is a silent success
      },
      body: JSON.stringify([{ email, source }]),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok && r.status !== 409) throw new Error('supabase ' + r.status);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'storage_unavailable' });
  }
};
