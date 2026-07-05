// Vercel serverless proxy for real-time bus arrivals (SIRI via curlbus).
// curlbus.app has no CORS headers, so the browser can't call it directly.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const stop = String((req.query && req.query.stop) || '').replace(/\D/g, '');
  if (!stop || stop.length < 3 || stop.length > 7) {
    res.status(400).json({ error: 'bad_stop' });
    return;
  }
  try {
    const upstream = await fetch('https://curlbus.app/' + stop, {
      headers: { Accept: 'application/json', 'User-Agent': 'ramat-gan-living-map/1.0' },
      signal: AbortSignal.timeout(9000),
    });
    if (!upstream.ok) throw new Error('upstream ' + upstream.status);
    const data = await upstream.json();
    // keep only what the map needs
    const visits = (data.visits && data.visits[stop]) || [];
    const out = visits.map(v => ({
      line: v.line_name,
      operator: v.operator_id,
      eta: v.eta,
    }));
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json({ ok: true, stop, timestamp: data.timestamp, arrivals: out });
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=10');
    res.status(502).json({ ok: false, error: 'upstream_unavailable' });
  }
};
