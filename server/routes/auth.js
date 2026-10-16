const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const EmployeeId = require('../models/EmployeeId');
const { COMPANY } = require('../lib/company');
const { COOKIE, requireAuth, setSessionCookie } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many attempts. Try again in a few minutes.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, message: { error: 'Too many sign-ups from this address. Try again later.' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.post('/register', registerLimiter, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const employeeId = String(req.body.employeeId || '').trim().toUpperCase();

  if (!employeeId) return res.status(400).json({ error: 'Enter your Employee ID.' });
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Enter your full name (2-60 characters).' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Password must be 8-72 characters and include a letter and a number.' });
  }

  try {
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
    // Role is NEVER read from the request: self-registration always creates an employee.
    const user = new User({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'employee', employeeId, company: COMPANY });

    // Claim the ID atomically: it must exist (issued by an admin) and be unused, and works only once.
    const claimed = await EmployeeId.findOneAndUpdate({ employeeId, claimedBy: null }, { claimedBy: user._id });
    if (!claimed) {
      const known = await EmployeeId.exists({ employeeId });
      return res.status(known ? 409 : 400).json({
        error: known ? 'This Employee ID is already registered.' : 'Employee ID not recognised. Check it with your admin.',
      });
    }
    user.department = claimed.department;
    try {
      await user.save();
    } catch (e) {
      await EmployeeId.updateOne({ _id: claimed._id }, { claimedBy: null }); // release the ID if saving failed
      throw e;
    }
    res.status(201).json({ message: 'Registration successful. Please log in.' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fail = () => res.status(401).json({ error: 'Invalid email or password.' });

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok || !user.isActive) return fail();

    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
    setSessionCookie(res, user);
    res.json({ user: user.toPublic(), redirect: user.role === 'admin' ? '/admin' : '/welcome' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ message: 'Logged out.' });
});

router.get('/me', requireAuth(), (req, res) => res.json({ user: req.user.toPublic() }));

module.exports = router;
