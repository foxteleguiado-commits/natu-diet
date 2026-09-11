module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token, id } = req.body || {};

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'Senha invalida' });
    return;
  }
  if (!id) {
    res.status(400).json({ error: 'id obrigatorio' });
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
    // Removes only this entry's own hash field — never reads or rewrites the rest
    // of the list, so it can't race with another approval/edit landing at once.
    const delResp = await fetch(`${kvUrl}/hdel/testimonials/${encodeURIComponent(id)}`, { headers });
    if (!delResp.ok) {
      res.status(502).json({ error: 'Falha ao remover' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover', detail: String(err) });
  }
};
