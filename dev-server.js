const express = require('express');
const path = require('path');
const chatHandler = require('./api/chat');
const contactHandler = require('./api/contact');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.all('/api/chat', chatHandler);
app.all('/api/contact', contactHandler);

// Serve frontend
app.use(express.static(path.join(__dirname, 'docs')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Local Vercel Dev Server running at http://localhost:${PORT}`);
});
