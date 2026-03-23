const allowedOrigins = ['https://semore.tech', 'https://www.semore.tech', 'https://se-more.github.io'];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sanitizeLine(value = '') {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

function encodeMimeMessage(message) {
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const gmailAccessToken = process.env.GMAIL_ACCESS_TOKEN || process.env.GMAIL_API_KEY;
  const destinationEmail = process.env.CONTACT_TO_EMAIL || 'contact@semore.tech';

  if (!gmailAccessToken) {
    return res.status(500).json({ error: 'GMAIL_ACCESS_TOKEN is not configured.' });
  }

  const name = sanitizeLine(req.body?.name);
  const email = sanitizeLine(req.body?.email);
  const company = sanitizeLine(req.body?.company);
  const message = String(req.body?.message || '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const subject = sanitizeLine(`New SE:MORE contact form submission from ${name}`);
  const plainText = [
    'New contact form submission',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || 'N/A'}`,
    '',
    'Message:',
    message
  ].join('\n');

  const rawMessage = [
    `To: ${destinationEmail}`,
    `Subject: ${subject}`,
    `Reply-To: ${email}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    plainText
  ].join('\r\n');

  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gmailAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodeMimeMessage(rawMessage) })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || 'Gmail API request failed.' });
    }

    const data = await response.json();
    return res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    console.error('Contact form send error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = handler;
