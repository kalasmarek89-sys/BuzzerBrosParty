import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const ANSWER_COLORS = [
  'bg-red-500 active:bg-red-700',
  'bg-blue-500 active:bg-blue-700',
  'bg-yellow-500 active:bg-yellow-700',
  'bg-green-500 active:bg-green-700',
];

const BRICK_LABEL = { gold: '🥇 Zlatá cihlička! +200', silver: '🥈 Stříbrná cihlička! +100', bronze: '🥉 Bronzová cihlička! +50' };

export default function GoldRushPlayPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, name } = location.state ?? {};

  const [phase, setPhase] = useState('waiting'); // waiting | question | answered | reveal | finished
  const [currentQ, setCurrentQ] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [revealData, setRevealData] = useState(null);
  const [scores, setScores] = useState([]);
  const [turnTeamName, setTurnTeamName] = useState('');
  const [timeLeft, setTimeLeft] = useState(25);
  const [bonusStealMsg, setBonusStealMsg] = useState('');
  const [pointsEarned, setPointsEarned] = useState(null);

  useEffect(() => {
    if (!pin || !name) { navigate('/'); return; }

    socket.on('gr:started', () => setPhase('waiting'));

    socket.on('gr:gridState', ({ turnTeamName: ttn, scores: sc }) => {
      setTurnTeamName(ttn);
      setScores(sc);
      setPhase('waiting');
    });

    socket.on('gr:questionOpen', (data) => {
      setCurrentQ(data);
      setSelectedAnswer(null);
      setRevealData(null);
      setBonusStealMsg('');
      setPointsEarned(null);
      setTimeLeft(25);
      setPhase('question');
    });

    socket.on('gr:answerAck', () => setPhase('answered'));

    socket.on('gr:reveal', (data) => {
      setRevealData(data);
      setScores(data.scores);
      // Find my result
      const mine = data.teamAnswers?.find((t) => t.name === name);
      setPointsEarned(mine?.pointsEarned ?? 0);
      setPhase('reveal');
    });

    socket.on('gr:bonusSteal', ({ stealerName, targetName, amount, scores: sc }) => {
      setScores(sc);
      setBonusStealMsg(`${stealerName} ukradl(a) ${amount} bodů od ${targetName}!`);
      setPhase('reveal');
    });

    socket.on('gr:finished', ({ scores: sc }) => {
      setScores(sc);
      setPhase('finished');
    });

    socket.on('game:hostLeft', () => { alert('Hostitel opustil hru.'); navigate('/'); });

    return () => socket.removeAllListeners();
  }, [pin, name, navigate]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'question' || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (phase === 'question' && timeLeft <= 0 && selectedAnswer === null) {
      setPhase('answered'); // timed out without answer
    }
  }, [timeLeft, phase, selectedAnswer]);

  function handleAnswer(i) {
    if (phase !== 'question') return;
    setSelectedAnswer(i);
    socket.emit('gr:answer', { pin, answer: i });
  }

  const myScore = scores.find((s) => s.name === name);
  const currentPoints = currentQ
    ? Math.max(0, Math.round(currentQ.basePoints * (timeLeft / 25)))
    : 0;

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-center">
          <div className="text-3xl font-extrabold text-yellow-400 animate-pulse">Čekej na výběr otázky…</div>
          {turnTeamName && (
            <p className="text-gray-400 mt-2">Vybírá: <strong className="text-white">{turnTeamName}</strong></p>
          )}
        </div>
        <p className="text-gray-500 text-sm">Jsi <strong className="text-white">{name}</strong></p>
        {myScore !== undefined && (
          <div className="text-2xl font-extrabold text-yellow-400">{myScore?.score ?? 0} b.</div>
        )}
        {scores.length > 0 && (
          <div className="w-full max-w-xs bg-gray-900 rounded-2xl p-4 flex flex-col gap-2">
            {scores.map((s, i) => (
              <div key={i} className={`flex justify-between text-sm ${s.name === name ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                <span>{i + 1}. {s.name}</span>
                <span>{s.score} b.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'question' || phase === 'answered') {
    return (
      <div className="flex flex-col min-h-screen px-4 py-8 gap-5 max-w-lg mx-auto">
        {/* Brick banner */}
        {currentQ?.brickType && (
          <div className="bg-yellow-500 text-gray-900 rounded-xl px-4 py-2 text-center font-bold text-sm">
            {BRICK_LABEL[currentQ.brickType]}
          </div>
        )}

        {/* Timer bar + points */}
        {phase === 'question' && !currentQ?.isBonus && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{timeLeft}s</span>
              <span className="font-bold text-yellow-400 text-lg">{currentPoints} b.</span>
            </div>
            <div className="relative bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all duration-1000"
                style={{ width: `${(timeLeft / 25) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'answered' && (
          <div className="text-center text-gray-400 text-sm animate-pulse">Čekám na výsledek…</div>
        )}

        {/* Question label */}
        <div className="text-xs text-gray-500 text-center uppercase tracking-widest">
          {currentQ?.isBonus ? '⭐ Bonusová otázka' : `${currentQ?.basePoints} bodů`}
        </div>

        {/* Question text */}
        <p className="text-xl font-bold text-center">{currentQ?.text}</p>

        {/* Answer buttons */}
        <div className="grid grid-cols-2 gap-3 flex-1 content-start">
          {currentQ?.answers.map((a, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={phase === 'answered'}
              className={`rounded-2xl p-4 flex flex-col items-center gap-2 font-bold text-base transition-all
                ${phase === 'answered'
                  ? selectedAnswer === i
                    ? 'bg-white text-gray-900 scale-95'
                    : 'bg-gray-800 opacity-40'
                  : ANSWER_COLORS[i]
                }`}
            >
              <span className="text-2xl font-extrabold">{ANSWER_LABELS[i]}</span>
              <span className="text-xs text-center leading-tight">{a}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'reveal') {
    const myAnswer = revealData?.teamAnswers?.find((t) => t.name === name);
    const correct = myAnswer?.correct ?? false;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-4">
        <div className="text-6xl">{correct ? '✅' : '❌'}</div>
        <p className="text-2xl font-bold">{correct ? 'Správně!' : 'Bohužel…'}</p>

        {revealData && (
          <div className="text-sm text-gray-400 text-center">
            Správná odpověď:{' '}
            <span className="font-bold text-white">
              {ANSWER_LABELS[revealData.correct]} – {currentQ?.answers[revealData.correct]}
            </span>
          </div>
        )}

        {correct && pointsEarned !== null && pointsEarned > 0 && (
          <div className="text-3xl font-extrabold text-yellow-400">+{pointsEarned} b.</div>
        )}

        {bonusStealMsg && (
          <div className="bg-orange-900/50 border border-orange-500 rounded-xl px-4 py-2 text-orange-300 text-sm font-bold text-center">
            {bonusStealMsg}
          </div>
        )}

        <div className="text-xl font-bold text-yellow-400">{myScore?.score ?? 0} b. celkem</div>

        <p className="text-gray-500 text-sm animate-pulse">Čekej na další otázku…</p>
      </div>
    );
  }

  if (phase === 'finished') {
    const rank = scores.findIndex((s) => s.name === name) + 1;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 max-w-sm mx-auto">
        <h2 className="text-4xl font-extrabold text-yellow-400">Konec hry!</h2>
        <div className="text-2xl font-bold text-white">
          {rank}. místo – {myScore?.score ?? 0} b.
        </div>
        <div className="w-full bg-gray-900 rounded-2xl p-6 flex flex-col gap-2">
          {scores.map((s, i) => (
            <div
              key={i}
              className={`flex justify-between text-sm ${s.name === name ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}
            >
              <span>{i + 1}. {s.name}</span>
              <span>{s.score} b.</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-xl py-3 px-8 font-bold transition-colors"
        >
          Hrát znovu
        </button>
      </div>
    );
  }
}
