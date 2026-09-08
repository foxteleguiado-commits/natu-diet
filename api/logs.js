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
    const [totalResp, uniqueResp, listResp] = await Promise.all([
      fetch(`${url}/get/total_visits`, { headers }),
      fetch(`${url}/scard/unique_ips`, { headers }),
      fetch(`${url}/lrange/pageviews/0/199`, { headers }),
    ]);
    const totalJson = await totalResp.json();
    const uniqueJson = await uniqueResp.json();
    const listJson = await listResp.json();

    const total = Number(totalJson.result || 0);
    const uniqueIps = Number(uniqueJson.result || 0);
    const entries = (listJson.result || [])
      .map((s) => { try { return JSON.parse(s); } catch (e) { return null; } })
      .filter(Boolean);

    res.status(200).json({ total, uniqueIps, entries });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler logs', detail: String(err) });
  }
};
