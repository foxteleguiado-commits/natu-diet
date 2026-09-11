async function backupToGithub(content) {
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) return;
  try {
    const owner = process.env.GITHUB_OWNER || 'foxteleguiado-commits';
    const repo = process.env.GITHUB_REPO || 'natu-diet';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content.json`;
    const headers = {
      Authorization: `Bearer ${ghToken}`,
      'User-Agent': 'natu-diet-admin',
      Accept: 'application/vnd.github+json',
    };
    const getResp = await fetch(`${apiUrl}?ref=${branch}`, { headers });
    if (!getResp.ok) return;
    const current = await getResp.json();
    const newContentBase64 = Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64');
    await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Backup content update via admin panel',
        content: newContentBase64,
        sha: current.sha,
        branch,
      }),
    });
  } catch (err) {
    // Best-effort backup only — the site already reflects the change via the database.
  }
}

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

  // Testimonials live in their own key (testimonials_list) now, managed by dedicated
  // endpoints, so a general content save can never clobber feedback that arrived after
  // the admin's page was loaded. Strip it here as a safety net even if the client
  // still sends a (possibly stale) copy.
  delete content.testimonials;

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(500).json({ error: 'KV nao configurado' });
    return;
  }

  try {
    const setResp = await fetch(`${kvUrl}/set/site_content`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}` },
      body: JSON.stringify(content),
    });
    if (!setResp.ok) {
      const detail = await setResp.text();
      res.status(502).json({ error: 'Falha ao salvar no banco', detail });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar', detail: String(err) });
    return;
  }

  // Fire-and-forget: back this up as a real commit, but don't make the admin wait for it.
  backupToGithub(content);

  res.status(200).json({ ok: true });
};
