module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const r = await fetch(`${kvUrl}/get/site_content`, { headers: { Authorization: `Bearer ${kvToken}` } });
      const j = await r.json();
      if (j && j.result) {
        res.status(200).json(JSON.parse(j.result));
        return;
      }
    } catch (err) {
      // fall through to the bundled seed below
    }
  }

  // First run, or KV unreachable: serve the bundled seed content.
  const fallback = require('../content.json');
  res.status(200).json(fallback);
};
