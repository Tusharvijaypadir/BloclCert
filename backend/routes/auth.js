const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/org-login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const adminEmail = process.env.ORG_ADMIN_EMAIL;
  const adminPassword = process.env.ORG_ADMIN_PASSWORD;

  // Prototype explicit matching logic
  if (email === adminEmail && password === adminPassword) {
    const token = jwt.sign(
      { email, role: 'org_admin' },
      process.env.JWT_SECRET || 'blockcert_secret',
      { expiresIn: '24h' }
    );
    return res.json({ token, message: 'Logged in successfully' });
  } else {
    return res.status(401).json({ error: 'Invalid organization credentials' });
  }
});

module.exports = router;
