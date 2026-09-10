module.exports = async (req, res) => {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'Senha invalida' });
    return;
  }

  const url = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!url || !kvToken) {
    res.status(500).json({ error: 'KV nao configurado' });
    return;
  }
  const headers = { Authorization: `Bearer ${kvToken}` };

  try {
    const r = await fetch(`${url}/hgetall/feedback_pending`, { headers });
    const j = await r.json();
    const flat = j.result || []; // [field1, value1, field2, value2, ...]
    const entries = [];
    for (let i = 0; i < flat.length; i += 2) {
      try { entries.push(JSON.parse(flat[i + 1])); } catch (e) { /* skip malformed */ }
    }
    entries.sort((a, b) => b.t - a.t);
    res.status(200).json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler pendentes', detail: String(err) });
  }
};
