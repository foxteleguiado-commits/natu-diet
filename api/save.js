module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token, content } = req.body || {};

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'Senha invalida' });
    return;
  }

  if (!content || typeof content !== 'object') {
    res.status(400).json({ error: 'Conteudo invalido' });
    return;
  }

  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    res.status(500).json({ error: 'GITHUB_TOKEN nao configurado na Vercel' });
    return;
  }

  const owner = process.env.GITHUB_OWNER || 'foxteleguiado-commits';
  const repo = process.env.GITHUB_REPO || 'natu-diet';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content.json`;
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    'User-Agent': 'natu-diet-admin',
    Accept: 'application/vnd.github+json',
  };

  try {
    const getResp = await fetch(`${apiUrl}?ref=${branch}`, { headers });
    if (!getResp.ok) {
      const detail = await getResp.text();
      res.status(502).json({ error: 'Falha ao ler content.json atual no GitHub', detail });
      return;
    }
    const current = await getResp.json();
    const newContentBase64 = Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64');

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update site content via admin panel',
        content: newContentBase64,
        sha: current.sha,
        branch,
      }),
    });

    if (!putResp.ok) {
      const detail = await putResp.text();
      res.status(502).json({ error: 'Falha ao salvar no GitHub', detail });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno', detail: String(err) });
  }
};
