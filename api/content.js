async function kvGet(url, token, key) {
  const r = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return j && j.result ? j.result : null;
}

async function kvHgetall(url, token, hash) {
  const r = await fetch(`${url}/hgetall/${hash}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  const flat = (j && j.result) || []; // [field1, value1, field2, value2, ...]
  const map = {};
  for (let i = 0; i < flat.length; i += 2) {
    try { map[flat[i]] = JSON.parse(flat[i + 1]); } catch (err) { /* skip malformed */ }
  }
  return map;
}

async function kvHset(url, token, hash, field, value) {
  await fetch(`${url}/hset/${hash}/${encodeURIComponent(field)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(value),
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const fallback = require('../content.json');

  let siteContent = fallback;
  let testimonials = fallback.testimonials || [];

  if (kvUrl && kvToken) {
    try {
      const rawSite = await kvGet(kvUrl, kvToken, 'site_content');
      if (rawSite) siteContent = JSON.parse(rawSite);
    } catch (err) {
      // keep bundled fallback for site content
    }

    try {
      // Each testimonial lives in its own hash field (keyed by id), so approving,
      // editing, removing or auto-publishing one entry never has to read-modify-write
      // the whole list — no race window where two writes can clobber each other.
      const map = await kvHgetall(kvUrl, kvToken, 'testimonials');
      const ids = Object.keys(map);

      if (ids.length) {
        testimonials = ids.map((id) => map[id]);
      } else {
        // One-time migration from the old single-key list (or the legacy embedded
        // field before that), the first time this runs after the upgrade.
        const rawTesti = await kvGet(kvUrl, kvToken, 'testimonials_list');
        const legacyList = rawTesti ? JSON.parse(rawTesti) : (siteContent.testimonials || fallback.testimonials || []);
        testimonials = legacyList.map((t) => {
          if (t && !t.id) return Object.assign({}, t, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) });
          return t;
        });
        testimonials.forEach((t) => { kvHset(kvUrl, kvToken, 'testimonials', t.id, t).catch(() => {}); });
      }
    } catch (err) {
      // keep whatever testimonials value we already had
    }
  }

  const merged = Object.assign({}, siteContent, { testimonials });
  res.status(200).json(merged);
};
