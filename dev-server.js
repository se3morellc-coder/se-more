const express = require('express');
const path = require('path');
const chatHandler = require('./api/chat');

const app = express();
const PORT = 8000;

app.use(express.json());

// Simulate Vercel /api/chat
app.post('/api/chat', async (req, res) => {
  // Mock Vercel req/res objects for the handler
  const mockReq = {
    method: 'POST',
    body: req.body
  };
  const mockRes = {
    status: (code) => ({
      json: (data) => res.status(code).json(data),
      text: (data) => res.status(code).send(data)
    })
  };
  await chatHandler(mockReq, mockRes);
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'frontend')));

app.listen(PORT, () => {
  console.log(`Local Vercel Dev Server running at http://localhost:${PORT}`);
});
