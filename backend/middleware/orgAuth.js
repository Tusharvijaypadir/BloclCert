const jwt = require('jsonwebtoken');

module.exports = function orgAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'blockcert_secret');
    if (decoded.role !== 'org_admin' || decoded.email !== process.env.ORG_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: Invalid role or email constraint' });
    }
    
    req.user = decoded; // Attach validated organization payload
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token is invalid or expired' });
  }
};
