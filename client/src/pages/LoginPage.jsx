import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.post('/api/auth/login', { email, password });
      login(token, user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-brand">BuzzerBros</h1>
        <p className="text-gray-400 mt-1">Přihlásit se</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 flex flex-col gap-4 shadow-xl"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tvuj@email.cz"
            required
            className="bg-gray-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Heslo</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
            className="bg-gray-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-brand hover:bg-brand-dark disabled:opacity-60 transition-colors rounded-xl py-3 font-bold text-lg"
        >
          {loading ? 'Přihlašuji…' : 'Přihlásit se'}
        </button>
      </form>

      <p className="text-gray-500 text-sm">
        Nemáš účet?{' '}
        <Link to="/register" className="text-brand-light hover:underline">
          Registrovat se
        </Link>
      </p>
      <Link to="/host" className="text-gray-600 text-sm hover:text-gray-400">
        ← Zpět
      </Link>
    </div>
  );
}
