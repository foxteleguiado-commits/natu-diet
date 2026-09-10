function clip(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!url || !kvToken) {
    res.status(500).json({ error: 'KV nao configurado' });
    return;
  }

  const body = req.body || {};

  // Honeypot: real visitors never fill this hidden field. Bots often do.
  // Pretend success without storing anything, so the bot doesn't learn to adapt.
  if (body.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = clip(body.name, 60);
  const text = clip(body.text, 500);
  let rating = parseInt(body.rating, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) rating = 5;

  if (!name || !text) {
    res.status(400).json({ error: 'Preencha nome e depoimento' });
    return;
  }

  const xff = req.headers['x-forwarded-for'] || '';
  const ip = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const entry = { id, name, rating, text, t: Date.now(), ip };

  const headers = { Authorization: `Bearer ${kvToken}` };

  try {
    await fetch(`${url}/hset/feedback_pending/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar', detail: String(err) });
  }
};
