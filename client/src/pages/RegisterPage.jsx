import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const [step, setStep] = useState('register'); // register | verify
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Hesla se neshodují.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/register', { email, password });
      setStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.post('/api/auth/verify', { email, code });
      login(token, user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'verify') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-brand">Ověření emailu</h1>
          <p className="text-gray-400 mt-1">
            Poslali jsme kód na <strong>{email}</strong>
          </p>
        </div>

        <form
          onSubmit={handleVerify}
          className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 flex flex-col gap-4 shadow-xl"
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Ověřovací kód</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              required
              className="bg-gray-800 rounded-xl px-4 py-3 text-3xl font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="mt-2 bg-brand hover:bg-brand-dark disabled:opacity-60 transition-colors rounded-xl py-3 font-bold text-lg"
          >
            {loading ? 'Ověřuji…' : 'Ověřit účet'}
          </button>
        </form>

        <button
          onClick={() => { setStep('register'); setError(''); }}
          className="text-gray-500 text-sm hover:text-gray-400"
        >
          ← Zadat jiný email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-brand">BuzzerBros</h1>
        <p className="text-gray-400 mt-1">Vytvořit účet</p>
      </div>

      <form
        onSubmit={handleRegister}
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
            placeholder="alespoň 6 znaků"
            required
            className="bg-gray-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Potvrdit heslo</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {loading ? 'Registruji…' : 'Registrovat se'}
        </button>
      </form>

      <p className="text-gray-500 text-sm">
        Už máš účet?{' '}
        <Link to="/login" className="text-brand-light hover:underline">
          Přihlásit se
        </Link>
      </p>
    </div>
  );
}
