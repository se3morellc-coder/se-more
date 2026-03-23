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

function formatGmailError(status, errorText) {
  if (status === 401) {
    return 'Email service authentication failed. Check the Google OAuth credentials in Vercel.';
  }

  if (status === 403) {
    return 'Email service permission denied. The Gmail token likely does not have Gmail send access.';
  }

  return errorText || 'Gmail API request failed.';
}

async function getGmailAccessToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      const details =
        tokenPayload.error_description || tokenPayload.error || 'Failed to refresh Gmail access token.';
      const error = new Error(details);
      error.status = tokenResponse.status || 500;
      throw error;
    }

    return tokenPayload.access_token;
  }

  const directAccessToken = process.env.GMAIL_ACCESS_TOKEN || process.env.GMAIL_API_KEY;
  if (directAccessToken) {
    return directAccessToken;
  }

  const error = new Error(
    'Google email credentials are not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel.'
  );
  error.status = 500;
  throw error;
}

async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const destinationEmail = process.env.CONTACT_TO_EMAIL || 'contact@semore.tech';

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
    const gmailAccessToken = await getGmailAccessToken();
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
      return res.status(response.status).json({
        error: formatGmailError(response.status, errorText),
        details: errorText || null
      });
    }

    const data = await response.json();
    return res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    console.error('Contact form send error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
  }
}

module.exports = handler;
