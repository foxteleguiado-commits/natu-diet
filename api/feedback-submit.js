function clip(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

// Best-effort: append straight to content.json's testimonials array via the GitHub API.
// Returns true on success, false on any failure (caller falls back to the pending queue).
async function tryAutoPublish(entry) {
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) return false;

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
    if (!getResp.ok) return false;
    const current = await getResp.json();
    const content = JSON.parse(Buffer.from(current.content, 'base64').toString('utf-8'));

    if (!Array.isArray(content.testimonials)) content.testimonials = [];
    content.testimonials.push({ name: entry.name, rating: entry.rating, text: entry.text, image: entry.image || '' });

    const newContentBase64 = Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64');
    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Auto-publish 5-star feedback',
        content: newContentBase64,
        sha: current.sha,
        branch,
      }),
    });
    return putResp.ok;
  } catch (err) {
    return false;
  }
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

  let image = clip(body.image, 300);
  if (image && !/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(image)) image = '';

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const entry = { id, name, rating, text, image, t: Date.now(), ip };

  // 5-star feedback publishes immediately, skipping the moderation queue.
  if (rating === 5) {
    const published = await tryAutoPublish(entry);
    if (published) {
      res.status(200).json({ ok: true, published: true });
      return;
    }
    // Fall through to the pending queue if the auto-publish attempt failed for any reason.
  }

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
