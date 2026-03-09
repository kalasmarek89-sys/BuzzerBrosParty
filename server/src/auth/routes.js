import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { sendVerificationEmail } from '../mailer.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email a heslo jsou povinné.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Heslo musí mít alespoň 6 znaků.' });
  }

  try {
    const existing = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(email);
    if (existing?.verified) {
      return res.status(409).json({ error: 'Uživatel s tímto emailem již existuje.' });
    }

    const hash = await bcrypt.hash(password, 10);
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);
    } else {
      db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
    }

    const code = generateCode();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
    db.prepare('INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

    await sendVerificationEmail(email, code);
    res.json({ status: 'verification_sent' });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Chyba serveru.' });
  }
});

// POST /api/auth/verify
router.post('/verify', (req, res) => {
  const { email, code } = req.body ?? {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email a kód jsou povinné.' });
  }

  const record = db
    .prepare('SELECT * FROM verification_codes WHERE email = ? AND code = ?')
    .get(email, code);

  if (!record) return res.status(400).json({ error: 'Neplatný ověřovací kód.' });
  if (Date.now() > record.expires_at) {
    db.prepare('DELETE FROM verification_codes WHERE id = ?').run(record.id);
    return res.status(400).json({ error: 'Kód vypršel. Zkus registraci znovu.' });
  }

  db.prepare('UPDATE users SET verified = 1 WHERE email = ?').run(email);
  db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email a heslo jsou povinné.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user?.password_hash) {
    return res.status(401).json({ error: 'Špatný email nebo heslo.' });
  }
  if (!user.verified) {
    return res.status(401).json({ error: 'Účet není ověřen. Zkontroluj email.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Špatný email nebo heslo.' });

  res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = verifyToken(auth.slice(7));
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
