import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api
      .get('/api/quizzes')
      .then(({ quizzes }) => setQuizzes(quizzes))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { id, name } = await api.post('/api/quizzes', { name: newName, questions: [] });
      // Go directly to host page to fill in questions
      navigate('/host', { state: { quiz: { id, name, questions: [] } } });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Opravdu smazat kvíz?')) return;
    try {
      await api.del(`/api/quizzes/${id}`);
      setQuizzes((qs) => qs.filter((q) => q.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePlay(quiz) {
    // Load full questions before navigating
    try {
      const { quiz: full } = await api.get(`/api/quizzes/${quiz.id}`);
      navigate('/host', { state: { quiz: full } });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-brand">Moje kvízy</h1>
          <p className="text-gray-500 text-sm mt-0.5">{user?.email}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/host"
            className="bg-green-600 hover:bg-green-700 transition-colors rounded-xl px-4 py-2 font-bold text-sm"
          >
            Rychlá hra
          </Link>
          <button
            onClick={logout}
            className="bg-gray-800 hover:bg-gray-700 transition-colors rounded-xl px-4 py-2 text-sm text-gray-400"
          >
            Odhlásit
          </button>
        </div>
      </div>

      {/* New quiz form */}
      <form onSubmit={handleCreate} className="flex gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Název nového kvízu…"
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-brand hover:bg-brand-dark disabled:opacity-50 transition-colors rounded-xl px-5 py-3 font-bold"
        >
          + Vytvořit
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Quiz list */}
      {loading ? (
        <p className="text-gray-500 text-center py-8">Načítám…</p>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p>Zatím žádné kvízy. Vytvoř první!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="bg-gray-900 rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-bold text-lg">{q.name}</p>
                <p className="text-gray-500 text-sm">
                  {q.question_count} {q.question_count === 1 ? 'otázka' : q.question_count < 5 ? 'otázky' : 'otázek'} ·{' '}
                  upraveno {new Date(q.updated_at).toLocaleDateString('cs-CZ')}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handlePlay(q)}
                  className="bg-brand hover:bg-brand-dark transition-colors rounded-xl px-4 py-2 font-bold text-sm"
                >
                  Hrát
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="bg-gray-800 hover:bg-red-900 transition-colors rounded-xl px-3 py-2 text-gray-400 hover:text-red-400 text-sm"
                >
                  Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
