module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token, id, name, rating, text, image } = req.body || {};

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'Senha invalida' });
    return;
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'KV nao configurado' });
    return;
  }
  const headers = { Authorization: `Bearer ${kvToken}` };

  try {
    const entry = {
      id: id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      name: String(name || '').slice(0, 80),
      rating: Math.max(1, Math.min(5, parseInt(rating, 10) || 5)),
      text: String(text || '').slice(0, 800),
      image: String(image || '').slice(0, 300),
    };

    // Writes only this entry's own hash field — editing or approving one testimonial
    // never touches, reads, or can lose any other entry, even if several are saved
    // at the same instant.
    const setResp = await fetch(`${kvUrl}/hset/testimonials/${encodeURIComponent(entry.id)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
    });
    if (!setResp.ok) {
      res.status(502).json({ error: 'Falha ao salvar' });
      return;
    }

    res.status(200).json({ ok: true, id: entry.id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar', detail: String(err) });
  }
};
