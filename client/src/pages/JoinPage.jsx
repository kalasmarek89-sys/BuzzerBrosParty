import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';

export default function JoinPage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleJoin(e) {
    e.preventDefault();
    setError('');
    if (!pin.trim() || !name.trim()) {
      setError('Zadej PIN i své jméno.');
      return;
    }

    setLoading(true);
    socket.connect();

    socket.once('player:joined', () => {
      navigate('/play', { state: { pin, name } });
    });

    socket.once('error', ({ message }) => {
      setError(message);
      setLoading(false);
      socket.disconnect();
    });

    socket.emit('player:join', { pin: pin.trim(), name: name.trim() });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-brand">
          BuzzerBros
          <span className="text-white"> Party</span>
        </h1>
        <p className="mt-2 text-gray-400">Připoj se ke hře</p>
      </div>

      <form
        onSubmit={handleJoin}
        className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 flex flex-col gap-4 shadow-xl"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Herní PIN</label>
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value.toUpperCase())}
            placeholder="např. ABC123"
            maxLength={10}
            className="bg-gray-800 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Tvoje jméno</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jméno nebo přezdívka"
            maxLength={20}
            className="bg-gray-800 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-brand hover:bg-brand-dark disabled:opacity-60 transition-colors rounded-xl py-3 font-bold text-lg"
        >
          {loading ? 'Připojuji…' : 'Připojit se'}
        </button>
      </form>

      <p className="text-gray-600 text-sm">
        Jsi hostitel?{' '}
        <a href="/host" className="text-brand-light hover:underline">
          Vytvoř hru
        </a>
      </p>
    </div>
  );
}
