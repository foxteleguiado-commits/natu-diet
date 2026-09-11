async function kvGet(url, token, key) {
  const r = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return j && j.result ? j.result : null;
}

async function kvSet(url, token, key, value) {
  await fetch(`${url}/set/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: value });
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
      const rawTesti = await kvGet(kvUrl, kvToken, 'testimonials_list');
      if (rawTesti) {
        testimonials = JSON.parse(rawTesti);
      } else {
        // One-time migration from the old embedded field, the first time this runs.
        testimonials = siteContent.testimonials || fallback.testimonials || [];
        kvSet(kvUrl, kvToken, 'testimonials_list', JSON.stringify(testimonials)).catch(() => {});
      }
    } catch (err) {
      // keep whatever testimonials value we already had
    }
  }

  const merged = Object.assign({}, siteContent, { testimonials });
  res.status(200).json(merged);
};
