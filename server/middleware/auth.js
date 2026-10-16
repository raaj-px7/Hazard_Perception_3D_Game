const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE = 'hh_token';

async function userFromRequest(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub);
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
}

// API guard: responds 401/403 JSON.
function requireAuth(roles) {
  return async (req, res, next) => {
    const user = await userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    if (roles && !roles.includes(user.role)) return res.status(403).json({ error: 'Not allowed.' });
    req.user = user;
    next();
  };
}

// Page guard: redirects instead of returning JSON.
function requirePage(role) {
  return async (req, res, next) => {
    const user = await userFromRequest(req);
    if (!user) return res.redirect('/login');
    if (user.role !== role) return res.redirect(user.role === 'admin' ? '/admin' : '/welcome');
    req.user = user;
    next();
  };
}

function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

module.exports = { COOKIE, userFromRequest, requireAuth, requirePage, setSessionCookie };
