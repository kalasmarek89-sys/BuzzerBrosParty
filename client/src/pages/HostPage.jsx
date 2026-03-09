import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { socket } from '../socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const ANSWER_COLORS = [
  'bg-red-500 hover:bg-red-600',
  'bg-blue-500 hover:bg-blue-600',
  'bg-yellow-500 hover:bg-yellow-600',
  'bg-green-500 hover:bg-green-600',
];

const emptyQuestion = () => ({
  text: '',
  answers: ['', '', '', ''],
  correct: 0,
  imageUrl: '',
  youtubeUrl: '',
  timeLimit: 30,
});

export default function HostPage() {
  const location = useLocation();
  const { user } = useAuth();
  const preloaded = location.state?.quiz ?? null;

  const [phase, setPhase] = useState('landing'); // landing | setup | lobby | question | reveal | finished
  const [pin, setPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState(
    preloaded?.questions?.length ? preloaded.questions : [emptyQuestion()]
  );
  const [currentQ, setCurrentQ] = useState(null);
  const [answerUpdate, setAnswerUpdate] = useState({ answered: 0, total: 0 });
  const [revealCorrect, setRevealCorrect] = useState(null);
  const [scores, setScores] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Saved quiz state
  const [loadedQuizId, setLoadedQuizId] = useState(preloaded?.id ?? null);
  const [quizName, setQuizName] = useState(preloaded?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // If navigated with a preloaded quiz, skip landing
  useEffect(() => {
    if (preloaded) setPhase('setup');
  }, []);

  useEffect(() => {
    socket.connect();

    socket.on('host:created', ({ pin }) => {
      setPin(pin);
      setPhase('lobby');
    });
    socket.on('host:playerJoined', ({ players }) => setPlayers(players));
    socket.on('host:playerLeft', ({ players }) => setPlayers(players));
    socket.on('host:answerUpdate', (data) => setAnswerUpdate(data));
    socket.on('game:question', (q) => {
      setCurrentQ(q);
      setRevealCorrect(null);
      setAnswerUpdate({ answered: 0, total: 0 });
      setPhase('question');
    });
    socket.on('game:reveal', ({ correct, scores }) => {
      setRevealCorrect(correct);
      setScores(scores);
      setPhase('reveal');
    });
    socket.on('game:finished', ({ scores }) => {
      setScores(scores);
      setPhase('finished');
    });
    socket.on('error', ({ message }) => setError(message));

    return () => socket.removeAllListeners();
  }, []);

  function handleCreate(e) {
    e.preventDefault();
    setError('');
    socket.emit('host:create', { pin: pinInput.trim().toUpperCase() });
  }

  function handleStartGame() {
    const valid = questions.filter(
      (q) => q.text.trim() && q.answers.filter((a) => a.trim()).length >= 2
    );
    if (valid.length === 0) {
      setError('Přidej alespoň jednu platnou otázku.');
      return;
    }
    socket.emit('host:setQuestions', { pin, questions: valid });
    socket.emit('host:startGame', { pin });
  }

  function handleReveal() {
    socket.emit('host:reveal', { pin });
  }

  function handleNext() {
    socket.emit('host:nextQuestion', { pin });
  }

  async function handleSaveQuiz() {
    setSaving(true);
    setSaveMsg('');
    try {
      if (loadedQuizId) {
        await api.put(`/api/quizzes/${loadedQuizId}`, { name: quizName || 'Bez názvu', questions });
        setSaveMsg('Uloženo!');
      } else {
        const name = quizName.trim() || 'Kvíz ' + new Date().toLocaleDateString('cs-CZ');
        const { id } = await api.post('/api/quizzes', { name, questions });
        setLoadedQuizId(id);
        setQuizName(name);
        setSaveMsg('Uloženo!');
      }
    } catch (err) {
      setSaveMsg('Chyba: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  function updateQuestion(idx, field, value) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  }

  function updateAnswer(qIdx, aIdx, value) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx ? { ...q, answers: q.answers.map((a, j) => (j === aIdx ? value : a)) } : q
      )
    );
  }

  async function handleImageUpload(qIdx, file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const { url } = await res.json();
      updateQuestion(qIdx, 'imageUrl', url);
    } catch {
      setError('Upload obrázku selhal.');
    } finally {
      setUploading(false);
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (phase === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="text-brand">Buzzer</span>
            <span className="text-white">Bros</span>
          </h1>
          <p className="text-gray-400 mt-2">Hostovat hru</p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <button
            onClick={() => setPhase('setup')}
            className="bg-brand hover:bg-brand-dark transition-colors rounded-2xl py-5 font-bold text-xl shadow-lg"
          >
            Rychlá hra
            <p className="text-brand-light font-normal text-sm mt-0.5">Bez účtu, jednorázově</p>
          </button>

          {user ? (
            <Link
              to="/dashboard"
              className="bg-gray-900 hover:bg-gray-800 transition-colors rounded-2xl py-5 font-bold text-xl text-center shadow-lg border border-gray-700"
            >
              Moje kvízy
              <p className="text-gray-400 font-normal text-sm mt-0.5">{user.email}</p>
            </Link>
          ) : (
            <Link
              to="/login"
              className="bg-gray-900 hover:bg-gray-800 transition-colors rounded-2xl py-5 font-bold text-xl text-center shadow-lg border border-gray-700"
            >
              Přihlásit se / Registrovat
              <p className="text-gray-500 font-normal text-sm mt-0.5">Ukládej kvízy, hraj kdykoliv</p>
            </Link>
          )}
        </div>

        <Link to="/" className="text-gray-600 text-sm hover:text-gray-400">
          Jsem hráč →
        </Link>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
        <h1 className="text-4xl font-extrabold text-brand">
          {preloaded ? preloaded.name : 'Vytvoř hru'}
        </h1>
        <form
          onSubmit={handleCreate}
          className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 flex flex-col gap-4 shadow-xl"
        >
          <label className="text-gray-400 text-sm">Zvol PIN pro hráče</label>
          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.toUpperCase())}
            placeholder="např. KVIZ24"
            maxLength={10}
            className="bg-gray-800 rounded-xl px-4 py-3 text-2xl font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-brand hover:bg-brand-dark rounded-xl py-3 font-bold text-lg transition-colors"
          >
            Vytvořit místnost
          </button>
        </form>
        <button
          onClick={() => setPhase('landing')}
          className="text-gray-600 text-sm hover:text-gray-400"
        >
          ← Zpět
        </button>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="text-center">
          <p className="text-gray-400 text-sm">Hráči se připojují přes</p>
          <div className="text-6xl font-extrabold font-mono tracking-widest text-brand mt-1">
            {pin}
          </div>
          <p className="text-gray-500 text-xs mt-1">buzzerbros.app → zadej PIN</p>
        </div>

        {/* Players */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-3">Připojení hráči ({players.length})</h2>
          {players.length === 0 ? (
            <p className="text-gray-500 text-sm">Zatím nikdo…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((p, i) => (
                <span key={i} className="bg-brand/20 text-brand-light rounded-full px-3 py-1 text-sm">
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Save quiz (logged-in users only) */}
        {user && (
          <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-3">
            <h3 className="font-bold text-gray-300 text-sm">Uložit kvíz do účtu</h3>
            <div className="flex gap-3">
              <input
                value={quizName}
                onChange={(e) => setQuizName(e.target.value)}
                placeholder="Název kvízu…"
                className="flex-1 bg-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                onClick={handleSaveQuiz}
                disabled={saving}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors rounded-xl px-4 py-2 text-sm font-bold"
              >
                {saving ? 'Ukládám…' : loadedQuizId ? 'Uložit změny' : 'Uložit'}
              </button>
            </div>
            {saveMsg && (
              <p className={`text-sm ${saveMsg.startsWith('Chyba') ? 'text-red-400' : 'text-green-400'}`}>
                {saveMsg}
              </p>
            )}
          </div>
        )}

        {/* Question editor */}
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-bold">Otázky ({questions.length})</h2>
          {questions.map((q, qi) => (
            <QuestionEditor
              key={qi}
              index={qi}
              question={q}
              onUpdate={(field, val) => updateQuestion(qi, field, val)}
              onAnswerUpdate={(ai, val) => updateAnswer(qi, ai, val)}
              onImageUpload={(file) => handleImageUpload(qi, file)}
              onRemove={
                questions.length > 1
                  ? () => setQuestions((qs) => qs.filter((_, i) => i !== qi))
                  : null
              }
            />
          ))}
          <button
            onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
            className="border-2 border-dashed border-gray-700 hover:border-brand rounded-xl py-3 text-gray-400 hover:text-brand transition-colors"
          >
            + Přidat otázku
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleStartGame}
          disabled={players.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 rounded-xl py-4 font-bold text-xl transition-colors"
        >
          Spustit hru →
        </button>
      </div>
    );
  }

  if (phase === 'question' || phase === 'reveal') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div className="flex justify-between text-gray-400 text-sm">
          <span>Otázka {(currentQ?.index ?? 0) + 1} / {currentQ?.total}</span>
          <span>PIN: <strong className="text-brand">{pin}</strong></span>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6">
          {currentQ?.imageUrl && (
            <img src={currentQ.imageUrl} alt="" className="w-full max-h-60 object-contain rounded-xl mb-4" />
          )}
          {currentQ?.youtubeUrl && (
            <div className="aspect-video mb-4">
              <iframe
                src={youtubeEmbed(currentQ.youtubeUrl)}
                className="w-full h-full rounded-xl"
                allowFullScreen
              />
            </div>
          )}
          <p className="text-2xl font-bold">{currentQ?.text}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {currentQ?.answers.map((a, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 flex items-center gap-3 ${
                phase === 'reveal'
                  ? i === revealCorrect
                    ? 'bg-green-600'
                    : 'bg-gray-800 opacity-50'
                  : ANSWER_COLORS[i]
              } transition-all`}
            >
              <span className="font-extrabold text-xl w-8 text-center">{ANSWER_LABELS[i]}</span>
              <span className="font-semibold">{a}</span>
            </div>
          ))}
        </div>

        {phase === 'question' && (
          <div className="text-center text-gray-400">
            Odpovědělo: <strong className="text-white">{answerUpdate.answered}</strong> / {answerUpdate.total}
          </div>
        )}

        {phase === 'question' && (
          <button
            onClick={handleReveal}
            className="bg-yellow-500 hover:bg-yellow-600 rounded-xl py-3 font-bold text-lg transition-colors"
          >
            Odhalit správnou odpověď
          </button>
        )}

        {phase === 'reveal' && (
          <>
            <Scoreboard scores={scores} />
            <button
              onClick={handleNext}
              className="bg-brand hover:bg-brand-dark rounded-xl py-3 font-bold text-lg transition-colors"
            >
              Další otázka →
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 flex flex-col gap-8 text-center">
        <h2 className="text-4xl font-extrabold">Konec hry! 🎉</h2>
        <Scoreboard scores={scores} />
        <button
          onClick={() => window.location.reload()}
          className="bg-brand hover:bg-brand-dark rounded-xl py-3 font-bold text-lg transition-colors"
        >
          Nová hra
        </button>
      </div>
    );
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionEditor({ index, question, onUpdate, onAnswerUpdate, onImageUpload, onRemove }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="font-bold text-gray-300">Otázka {index + 1}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-gray-500 hover:text-red-400 text-sm transition-colors">
            Odebrat
          </button>
        )}
      </div>

      <textarea
        value={question.text}
        onChange={(e) => onUpdate('text', e.target.value)}
        placeholder="Text otázky…"
        rows={2}
        className="bg-gray-800 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="grid grid-cols-2 gap-2">
        {question.answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate('correct', i)}
              className={`w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 transition-colors ${
                question.correct === i ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}
              title="Nastavit jako správnou"
            >
              {ANSWER_LABELS[i]}
            </button>
            <input
              value={a}
              onChange={(e) => onAnswerUpdate(i, e.target.value)}
              placeholder={`Odpověď ${ANSWER_LABELS[i]}`}
              className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500">Obrázek (upload)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onImageUpload(e.target.files?.[0])}
          className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-brand/20 file:text-brand-light hover:file:bg-brand/30"
        />
        {question.imageUrl && (
          <img src={question.imageUrl} alt="náhled" className="max-h-32 object-contain rounded-lg" />
        )}

        <label className="text-xs text-gray-500 mt-1">YouTube URL</label>
        <input
          value={question.youtubeUrl}
          onChange={(e) => onUpdate('youtubeUrl', e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500">Čas na odpověď (s):</label>
        <input
          type="number"
          min={5}
          max={120}
          value={question.timeLimit}
          onChange={(e) => onUpdate('timeLimit', Number(e.target.value))}
          className="w-16 bg-gray-800 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
    </div>
  );
}

function Scoreboard({ scores }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-2">
      <h3 className="font-bold text-gray-300 mb-1">Skóre</h3>
      {scores.map((s, i) => (
        <div key={i} className="flex justify-between items-center">
          <span className="flex items-center gap-2">
            <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
            <span>{s.name}</span>
          </span>
          <span className="font-bold text-brand-light">{s.score} b.</span>
        </div>
      ))}
    </div>
  );
}

function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('v') || u.pathname.split('/').pop();
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return url;
  }
}
