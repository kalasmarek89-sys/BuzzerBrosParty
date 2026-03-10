import { Router } from 'express';
import { db } from '../db.js';
import { verifyToken } from '../auth/routes.js';

const router = Router();

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = verifyToken(auth.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/quizzes
router.get('/', authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, type,
        (SELECT COUNT(*) FROM json_each(questions)) AS question_count,
        created_at, updated_at
       FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC`
    )
    .all(req.user.userId);
  res.json({ quizzes: rows });
});

// GET /api/quizzes/:id
router.get('/:id', authMiddleware, (req, res) => {
  const row = db
    .prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.userId);
  if (!row) return res.status(404).json({ error: 'Kvíz nenalezen.' });
  res.json({ quiz: { ...row, questions: JSON.parse(row.questions) } });
});

// POST /api/quizzes
router.post('/', authMiddleware, (req, res) => {
  const { name, questions, type = 'classic' } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'Název kvízu je povinný.' });
  const result = db
    .prepare('INSERT INTO quizzes (user_id, name, questions, type) VALUES (?, ?, ?, ?)')
    .run(req.user.userId, name.trim(), JSON.stringify(questions ?? []), type);
  res.json({ id: result.lastInsertRowid, name: name.trim() });
});

// PUT /api/quizzes/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { name, questions, type } = req.body ?? {};
  const row = db
    .prepare('SELECT id FROM quizzes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.userId);
  if (!row) return res.status(404).json({ error: 'Kvíz nenalezen.' });
  db.prepare(
    'UPDATE quizzes SET name = ?, questions = ?, type = COALESCE(?, type), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name?.trim() ?? '', JSON.stringify(questions ?? []), type ?? null, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/quizzes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const row = db
    .prepare('SELECT id FROM quizzes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.userId);
  if (!row) return res.status(404).json({ error: 'Kvíz nenalezen.' });
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
