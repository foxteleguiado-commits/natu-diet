const { put } = require('@vercel/blob');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 4 * 1024 * 1024; // 4MB

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { filename, dataUrl } = req.body || {};
  if (!filename || !dataUrl) {
    res.status(400).json({ error: 'Dados invalidos' });
    return;
  }

  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    res.status(400).json({ error: 'Formato de imagem invalido' });
    return;
  }
  const mime = match[1];
  if (ALLOWED_MIME.indexOf(mime) === -1) {
    res.status(400).json({ error: 'Tipo de imagem nao suportado' });
    return;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_BYTES) {
    res.status(400).json({ error: 'Imagem muito grande (maximo 4MB)' });
    return;
  }

  const safeName = 'feedback/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' +
    String(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 80);

  try {
    const blob = await put(safeName, buffer, { access: 'public', contentType: mime });
    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar imagem', detail: String(err) });
  }
};
