import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { socket } from '../socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const POINT_VALUES = [100, 200, 300, 400, 500, 600];
const CATEGORY_COLORS = ['#3B82F6', '#F97316', '#EF4444', '#22C55E', '#A855F7', '#EC4899'];

const BRICK_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const BRICK_LABEL = { gold: '+200', silver: '+100', bronze: '+50' };
const BRICK_BG = { gold: 'bg-yellow-500', silver: 'bg-gray-400', bronze: 'bg-amber-700' };

function defaultCategories() {
  return CATEGORY_COLORS.map((color, i) => ({
    name: `Kategorie ${i + 1}`,
    color,
    questions: [
      ...POINT_VALUES.map((points) => ({
        text: '', answers: ['', '', '', ''], correct: 0, points, answered: false,
      })),
      { text: '', answers: ['', '', '', ''], correct: 0, bonus: true, answered: false },
    ],
  }));
}

function stripAnswered(categories) {
  return categories.map((cat) => ({
    ...cat,
    questions: cat.questions.map((q) => ({ ...q, answered: false })),
  }));
}

function prepareForSave(categories) {
  return categories.map((cat) => ({
    ...cat,
    questions: cat.questions.map(({ answered: _a, ...q }) => q),
  }));
}

export default function GoldRushHostPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const preloaded = location.state?.quiz ?? null;

  const [phase, setPhase] = useState(preloaded ? 'lobby' : 'setup');
  const [pin, setPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState([]);

  // Quiz data
  const [categories, setCategories] = useState(
    preloaded ? stripAnswered(preloaded.questions) : defaultCategories()
  );
  const [activeTab, setActiveTab] = useState(0);
  const [quizId, setQuizId] = useState(preloaded?.id ?? null);
  const [quizName, setQuizName] = useState(preloaded?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Game state
  const [gridData, setGridData] = useState(null);
  const [turnTeamName, setTurnTeamName] = useState('');
  const [scores, setScores] = useState([]);
  const [currentQ, setCurrentQ] = useState(null); // { text, answers, brickType, isBonus, basePoints }
  const [answerUpdate, setAnswerUpdate] = useState({ answered: 0, total: 0 });
  const [revealData, setRevealData] = useState(null);
  const [bonusStealMsg, setBonusStealMsg] = useState('');
  const [stealInfo, setStealInfo] = useState(null); // { stealTeamSocketId, stealTeamName }

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setError('Nelze se připojit k serveru.'));

    socket.on('host:created', ({ pin: p }) => { setPin(p); setPhase('lobby'); });
    socket.on('host:playerJoined', ({ players: ps }) => setPlayers(ps));
    socket.on('host:playerLeft', ({ players: ps }) => setPlayers(ps));

    socket.on('gr:started', () => setPhase('grid'));
    socket.on('gr:gridState', ({ categories: cats, turnTeamName: ttn, scores: sc }) => {
      setGridData(cats);
      setTurnTeamName(ttn);
      setScores(sc);
      setPhase('grid');
    });
    socket.on('gr:questionOpen', (data) => {
      setCurrentQ(data);
      setAnswerUpdate({ answered: 0, total: players.length });
      setRevealData(null);
      setBonusStealMsg('');
      setStealInfo(null);
      setPhase('question');
    });
    socket.on('gr:answerUpdate', (data) => setAnswerUpdate(data));
    socket.on('gr:reveal', (data) => {
      setRevealData(data);
      setScores(data.scores);
      if (data.needsSteal) {
        setStealInfo({ stealTeamSocketId: data.stealTeamSocketId, stealTeamName: data.stealTeamName });
        setPhase('bonus_steal');
      } else {
        setPhase('reveal');
      }
    });
    socket.on('gr:bonusSteal', ({ stealerName, targetName, amount, scores: sc }) => {
      setScores(sc);
      setBonusStealMsg(`${stealerName} ukradl(a) ${amount} bodů od ${targetName}!`);
      setStealInfo(null);
      setPhase('reveal');
    });
    socket.on('gr:finished', ({ scores: sc }) => { setScores(sc); setPhase('finished'); });
    socket.on('error', ({ message }) => setError(message));

    return () => socket.removeAllListeners();
  }, []);

  function handleCreate(e) {
    e.preventDefault();
    setError('');
    socket.emit('host:create', { pin: pinInput.trim().toUpperCase(), mode: 'goldrush' });
  }

  function handleStartGame() {
    socket.emit('gr:setCategories', { pin, categories: prepareForSave(categories) });
    socket.emit('gr:startGame', { pin });
  }

  function handleSelectQuestion(catIdx, qIdx) {
    socket.emit('gr:selectQuestion', { pin, catIdx, qIdx });
  }

  function handleReveal() {
    socket.emit('gr:reveal', { pin });
  }

  function handleSteal(targetSocketId) {
    socket.emit('gr:stealTarget', { pin, targetSocketId });
  }

  function handleBackToGrid() {
    socket.emit('gr:backToGrid', { pin });
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      const data = {
        name: quizName.trim() || 'GoldRush kvíz',
        questions: prepareForSave(categories),
        type: 'goldrush',
      };
      if (quizId) {
        await api.put(`/api/quizzes/${quizId}`, data);
        setSaveMsg('Uloženo!');
      } else {
        const { id } = await api.post('/api/quizzes', data);
        setQuizId(id);
        setQuizName(data.name);
        setSaveMsg('Uloženo!');
      }
    } catch (err) {
      setSaveMsg('Chyba: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  function updateCategoryName(ci, name) {
    setCategories((cats) => cats.map((c, i) => i === ci ? { ...c, name } : c));
  }

  function updateQuestion(ci, qi, field, value) {
    setCategories((cats) => cats.map((c, i) =>
      i === ci ? {
        ...c,
        questions: c.questions.map((q, j) => j === qi ? { ...q, [field]: value } : q),
      } : c
    ));
  }

  function updateAnswer(ci, qi, ai, value) {
    setCategories((cats) => cats.map((c, i) =>
      i === ci ? {
        ...c,
        questions: c.questions.map((q, j) =>
          j === qi ? { ...q, answers: q.answers.map((a, k) => k === ai ? value : a) } : q
        ),
      } : c
    ));
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-yellow-400">GoldRush</h1>
          <p className="text-gray-400 mt-1">Vytvoř herní místnost</p>
        </div>
        <form
          onSubmit={handleCreate}
          className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 flex flex-col gap-4 shadow-xl"
        >
          <label className="text-gray-400 text-sm">PIN pro hráče</label>
          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.toUpperCase())}
            placeholder="např. GOLD24"
            maxLength={10}
            className="bg-gray-800 rounded-xl px-4 py-3 text-2xl font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!connected}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 rounded-xl py-3 font-bold text-lg transition-colors"
          >
            {connected ? 'Vytvořit místnost' : 'Připojuji…'}
          </button>
        </form>
        <Link to="/host" className="text-gray-600 text-sm hover:text-gray-400">← Zpět</Link>
      </div>
    );
  }

  if (phase === 'lobby') {
    const cat = categories[activeTab];
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold text-yellow-400">GoldRush</h1>
            <div className="mt-1">
              <span className="text-gray-400 text-sm">PIN: </span>
              <span className="text-2xl font-mono font-extrabold text-yellow-400">{pin}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Hráči ({players.length}/6)</p>
            <div className="flex flex-wrap gap-1 mt-1 justify-end">
              {players.map((p, i) => (
                <span key={i} className="bg-yellow-500/20 text-yellow-300 rounded-full px-3 py-0.5 text-sm">{p.name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Save */}
        {user && (
          <div className="bg-gray-900 rounded-2xl p-4 flex gap-3 items-center">
            <input
              value={quizName}
              onChange={(e) => setQuizName(e.target.value)}
              placeholder="Název kvízu…"
              className="flex-1 bg-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl px-4 py-2 text-sm font-bold transition-colors"
            >
              {saving ? 'Ukládám…' : quizId ? 'Uložit' : 'Uložit jako nový'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.startsWith('Chyba') ? 'text-red-400' : 'text-green-400'}`}>{saveMsg}</span>
            )}
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === i ? 'text-white scale-105' : 'opacity-60 hover:opacity-80'
              }`}
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Category editor */}
        <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-4">
          <input
            value={cat.name}
            onChange={(e) => updateCategoryName(activeTab, e.target.value)}
            placeholder="Název kategorie"
            className="bg-gray-800 rounded-xl px-4 py-2 font-bold text-lg focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cat.color }}
          />
          <div className="flex flex-col gap-4">
            {cat.questions.map((q, qi) => (
              <QuestionEditor
                key={qi}
                question={q}
                label={q.bonus ? '⭐ Bonus' : `${POINT_VALUES[qi]} bodů`}
                color={cat.color}
                onUpdate={(field, val) => updateQuestion(activeTab, qi, field, val)}
                onAnswerUpdate={(ai, val) => updateAnswer(activeTab, qi, ai, val)}
              />
            ))}
          </div>
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

  // ── GRID + OVERLAYS ───────────────────────────────────────────────────────
  if (phase === 'grid' || phase === 'question' || phase === 'reveal' || phase === 'bonus_steal') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        {/* Top bar */}
        <div className="flex justify-between items-center px-4 py-2 bg-gray-900 border-b border-gray-800">
          <span className="text-gray-400 text-sm">PIN: <strong className="text-yellow-400 font-mono">{pin}</strong></span>
          <span className="text-gray-400 text-sm font-bold">
            Vybírá: <span className="text-white">{turnTeamName}</span>
          </span>
          <div className="flex gap-2 text-sm">
            {scores.slice(0, 3).map((s, i) => (
              <span key={i} className="text-gray-300">{s.name}: <strong className="text-yellow-400">{s.score}</strong></span>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 p-3 flex flex-col gap-2">
          {/* Category headers */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridData?.length ?? 6}, 1fr)` }}>
            {(gridData ?? categories).map((cat, ci) => (
              <div
                key={ci}
                className="rounded-xl p-3 text-center font-extrabold text-sm"
                style={{ backgroundColor: cat.color }}
              >
                {cat.name}
              </div>
            ))}
          </div>

          {/* Question rows 100-600 */}
          {POINT_VALUES.map((pts, qi) => (
            <div key={qi} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridData?.length ?? 6}, 1fr)` }}>
              {(gridData ?? categories).map((cat, ci) => {
                const q = cat.questions[qi];
                const answered = q?.answered ?? false;
                return (
                  <button
                    key={ci}
                    onClick={() => phase === 'grid' && !answered && handleSelectQuestion(ci, qi)}
                    disabled={answered || phase !== 'grid'}
                    className={`rounded-xl py-6 font-extrabold text-2xl transition-all ${
                      answered
                        ? 'bg-gray-800 opacity-20 cursor-default'
                        : phase === 'grid'
                          ? 'hover:brightness-125 active:scale-95 cursor-pointer'
                          : 'cursor-default'
                    }`}
                    style={{ backgroundColor: answered ? undefined : cat.color }}
                  >
                    {answered ? '' : pts}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Bonus row */}
          <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: `repeat(${gridData?.length ?? 6}, 1fr)` }}>
            {(gridData ?? categories).map((cat, ci) => {
              const qs = cat.questions;
              const allRegular = qs.slice(0, 6).every((q) => q.answered);
              const bonus = qs[6];
              if (!allRegular || bonus?.answered) {
                return <div key={ci} className="py-3" />;
              }
              return (
                <button
                  key={ci}
                  onClick={() => phase === 'grid' && handleSelectQuestion(ci, 6)}
                  disabled={phase !== 'grid'}
                  className="rounded-xl py-3 font-bold text-sm transition-all hover:brightness-125 active:scale-95"
                  style={{ backgroundColor: cat.color }}
                >
                  ⭐ Bonus
                </button>
              );
            })}
          </div>
        </div>

        {/* QUESTION OVERLAY */}
        {(phase === 'question' || phase === 'reveal' || phase === 'bonus_steal') && currentQ && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full flex flex-col gap-4 shadow-2xl">
              {/* Brick banner */}
              {currentQ.brickType && (
                <div className={`rounded-xl px-4 py-2 text-center font-extrabold text-lg ${BRICK_BG[currentQ.brickType]} text-white`}>
                  {BRICK_EMOJI[currentQ.brickType]} Cihlička nalezena! {BRICK_LABEL[currentQ.brickType]} bodů pro {turnTeamName}
                </div>
              )}

              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>{currentQ.isBonus ? '⭐ Bonusová otázka' : `${currentQ.basePoints} bodů`}</span>
                <span>Odpovědělo: <strong className="text-white">{answerUpdate.answered}/{answerUpdate.total}</strong></span>
              </div>

              <p className="text-2xl font-bold">{currentQ.text}</p>

              <div className="grid grid-cols-2 gap-3">
                {currentQ.answers.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-4 flex items-center gap-3 transition-all ${
                      phase === 'reveal' || phase === 'bonus_steal'
                        ? i === revealData?.correct
                          ? 'bg-green-600'
                          : 'bg-gray-800 opacity-40'
                        : ['bg-red-600', 'bg-blue-600', 'bg-yellow-600', 'bg-green-600'][i]
                    }`}
                  >
                    <span className="font-extrabold text-xl w-7 text-center">{ANSWER_LABELS[i]}</span>
                    <span className="font-semibold text-sm">{a}</span>
                  </div>
                ))}
              </div>

              {/* Team answers after reveal */}
              {(phase === 'reveal' || phase === 'bonus_steal') && revealData && (
                <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-2">
                  {revealData.teamAnswers.map((ta, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className={ta.correct ? 'text-green-400 font-bold' : 'text-gray-400'}>{ta.name}</span>
                      <span className={ta.correct ? 'text-green-400 font-bold' : 'text-gray-500'}>
                        {ta.correct ? (ta.pointsEarned > 0 ? `+${ta.pointsEarned} b.` : '✓') : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bonus steal notification */}
              {bonusStealMsg && (
                <div className="bg-orange-900/50 border border-orange-500 rounded-xl p-3 text-center text-orange-300 font-bold text-sm">
                  {bonusStealMsg}
                </div>
              )}

              {/* Action buttons */}
              {phase === 'question' && (
                <button
                  onClick={handleReveal}
                  className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-xl py-3 font-bold text-lg transition-colors"
                >
                  Odhalit odpověď
                </button>
              )}

              {phase === 'bonus_steal' && stealInfo && (
                <div className="flex flex-col gap-3">
                  <p className="text-center text-yellow-400 font-bold">
                    {stealInfo.stealTeamName} odpověděl správně – vyber tým ke krádeži 50 bodů:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {scores
                      .filter((s) => s.socketId !== stealInfo.stealTeamSocketId)
                      .map((s) => (
                        <button
                          key={s.socketId}
                          onClick={() => handleSteal(s.socketId)}
                          className="bg-red-600 hover:bg-red-500 rounded-xl px-4 py-2 font-bold text-sm transition-colors"
                        >
                          {s.name} ({s.score} b.)
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {phase === 'reveal' && (
                <>
                  <GRScoreboard scores={scores} />
                  <button
                    onClick={handleBackToGrid}
                    className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-xl py-3 font-bold text-lg transition-colors"
                  >
                    Zpět na grid →
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 flex flex-col gap-8 text-center">
        <h2 className="text-4xl font-extrabold text-yellow-400">Konec hry!</h2>
        <GRScoreboard scores={scores} />
        <button
          onClick={() => window.location.reload()}
          className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-xl py-3 font-bold text-lg transition-colors"
        >
          Nová hra
        </button>
      </div>
    );
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QuestionEditor({ question, label, color, onUpdate, onAnswerUpdate }) {
  return (
    <div className="border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
      <textarea
        value={question.text}
        onChange={(e) => onUpdate('text', e.target.value)}
        placeholder="Text otázky…"
        rows={2}
        className="bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <div className="grid grid-cols-2 gap-2">
        {question.answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate('correct', i)}
              className={`w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${
                question.correct === i ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {ANSWER_LABELS[i]}
            </button>
            <input
              value={a}
              onChange={(e) => onAnswerUpdate(i, e.target.value)}
              placeholder={`Odpověď ${ANSWER_LABELS[i]}`}
              className="flex-1 bg-gray-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function GRScoreboard({ scores }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-2">
      {scores.map((s, i) => (
        <div key={i} className="flex justify-between items-center">
          <span className="flex items-center gap-2">
            <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
            <span className="text-sm">{s.name}</span>
          </span>
          <span className="font-bold text-yellow-400">{s.score} b.</span>
        </div>
      ))}
    </div>
  );
}
