require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { userFromRequest, requirePage } = require('./middleware/auth');
const { COMPANY } = require('./lib/company');

if (!process.env.VERCEL) {
  for (const k of ['MONGODB_URI', 'JWT_SECRET']) {
    if (!process.env[k]) { console.error(`Missing ${k} in .env`); process.exit(1); }
  }
}

const app = express();
app.set('trust proxy', 1);
const client = path.join(__dirname, '..', 'client');
const view = (name) => (req, res) => res.sendFile(path.join(client, 'views', name));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' is needed only for the game's inline import map; unpkg serves Three.js.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
    },
  },
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/api/config', (req, res) => res.json({ company: COMPANY }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use('/static', express.static(path.join(client, 'public')));
app.use('/game-assets', express.static(path.join(client, 'game-assets')));

// Pages
app.get('/', async (req, res) => {
  const user = await userFromRequest(req);
  res.redirect(!user ? '/login' : user.role === 'admin' ? '/admin' : '/welcome');
});
// Login/register bounce already-logged-in users to their portal.
for (const [route, file] of [['/login', 'login.html'], ['/register', 'register.html']]) {
  app.get(route, async (req, res) => {
    const user = await userFromRequest(req);
    if (user) return res.redirect(user.role === 'admin' ? '/admin' : '/welcome');
    res.sendFile(path.join(client, 'views', file));
  });
}
app.get('/welcome', requirePage('employee'), view('welcome.html'));
app.get('/quiz', requirePage('employee'), view('quiz.html'));
app.get('/game', requirePage('employee'), view('game.html'));
app.get('/admin', requirePage('admin'), view('admin.html'));

app.use((req, res) => res.status(404).redirect('/'));

// On Vercel, api/index.js handles the MongoDB connection and invokes the app.
// Locally (or on Render/Railway), start the server the traditional way.
if (!process.env.VERCEL) {
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Hazard Hunt running at http://localhost:${port}`));
  }).catch((err) => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
}

module.exports = app;
