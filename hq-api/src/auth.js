const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this-jwt-secret';
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'please-change-this-internal-token';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      branchCode: user.branch_code,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '請先登入' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: '權限不足' });

// 分店服務呼叫總部的內部 API 時使用（不對外開放，Nginx 也會擋掉）
function requireInternal(req, res, next) {
  if (req.headers['x-internal-token'] === INTERNAL_TOKEN) return next();
  res.status(403).json({ error: 'invalid internal token' });
}

module.exports = { signToken, requireAuth, requireRole, requireInternal };
