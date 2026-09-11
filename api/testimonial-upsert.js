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
    const getResp = await fetch(`${kvUrl}/get/testimonials_list`, { headers });
    const getJson = await getResp.json();
    let list = (getJson && getJson.result) ? JSON.parse(getJson.result) : [];

    const entry = {
      id: id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      name: String(name || '').slice(0, 80),
      rating: Math.max(1, Math.min(5, parseInt(rating, 10) || 5)),
      text: String(text || '').slice(0, 800),
      image: String(image || '').slice(0, 300),
    };

    const idx = id ? list.findIndex((t) => t.id === id) : -1;
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);

    const setResp = await fetch(`${kvUrl}/set/testimonials_list`, {
      method: 'POST',
      headers,
      body: JSON.stringify(list),
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
