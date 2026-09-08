function parseUA(ua) {
  var browser = 'Desconhecido';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/.test(ua)) browser = 'Internet Explorer';

  var os = 'Desconhecido';
  if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  var device = 'Desktop';
  if (/iPad|Tablet/.test(ua)) device = 'Tablet';
  else if (/Mobi|Android.*Mobile|iPhone/.test(ua)) device = 'Celular';

  return { browser: browser, os: os, device: device };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    res.status(500).json({ error: 'KV nao configurado' });
    return;
  }

  const xff = req.headers['x-forwarded-for'] || '';
  const ip = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
  const ua = req.headers['user-agent'] || '';
  const parsed = parseUA(ua);
  const path = (req.body && req.body.path) || '';
  const referrer = req.headers['referer'] || '';

  const entry = {
    t: Date.now(),
    ip: ip,
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    path: path,
    referrer: referrer,
  };

  const headers = { Authorization: `Bearer ${token}` };

  try {
    await fetch(`${url}/lpush/pageviews`, { method: 'POST', headers, body: JSON.stringify(entry) });
    await fetch(`${url}/ltrim/pageviews/0/1999`, { headers });
    await fetch(`${url}/incr/total_visits`, { headers });
    if (ip) await fetch(`${url}/sadd/unique_ips/${encodeURIComponent(ip)}`, { headers });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar', detail: String(err) });
  }
};
