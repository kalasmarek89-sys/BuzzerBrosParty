import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const ANSWER_COLORS = [
  'bg-red-500 active:bg-red-700',
  'bg-blue-500 active:bg-blue-700',
  'bg-yellow-500 active:bg-yellow-700',
  'bg-green-500 active:bg-green-700',
];

export default function PlayPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, name } = location.state ?? {};

  const [phase, setPhase] = useState('waiting'); // waiting | question | answered | reveal | finished
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [scores, setScores] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!pin || !name) {
      navigate('/');
      return;
    }

    socket.on('game:started', () => setPhase('waiting'));

    socket.on('game:question', (q) => {
      setQuestion(q);
      setSelectedAnswer(null);
      setCorrectAnswer(null);
      setTimeLeft(q.timeLimit);
      setPhase('question');
    });

    socket.on('player:answerAck', () => setPhase('answered'));

    socket.on('game:reveal', ({ correct, scores }) => {
      setCorrectAnswer(correct);
      setScores(scores);
      setPhase('reveal');
    });

    socket.on('game:finished', ({ scores }) => {
      setScores(scores);
      setPhase('finished');
    });

    socket.on('game:hostLeft', () => {
      alert('Hostitel opustil hru.');
      navigate('/');
    });

    return () => socket.removeAllListeners();
  }, [pin, name, navigate]);

  // Countdown
  useEffect(() => {
    if (phase !== 'question' || timeLeft === null) return;
    if (timeLeft <= 0) {
      setPhase('answered'); // time's up
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  function handleAnswer(i) {
    if (phase !== 'question') return;
    setSelectedAnswer(i);
    socket.emit('player:answer', { pin, answer: i });
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-2xl font-bold text-brand animate-pulse">Čekej na hostitele…</div>
        <p className="text-gray-400">Jsi přihlášen jako <strong className="text-white">{name}</strong></p>
      </div>
    );
  }

  if (phase === 'question' || phase === 'answered') {
    return (
      <div className="flex flex-col min-h-screen px-4 py-8 gap-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex justify-between text-sm text-gray-400">
          <span>{name}</span>
          <span className={`font-bold text-lg ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {phase === 'question' ? `${timeLeft}s` : '✓'}
          </span>
        </div>

        {/* Media */}
        {question?.imageUrl && (
          <img src={question.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl" />
        )}
        {question?.youtubeUrl && (
          <div className="aspect-video">
            <iframe
              src={youtubeEmbed(question.youtubeUrl)}
              className="w-full h-full rounded-xl"
              allowFullScreen
            />
          </div>
        )}

        {/* Question text */}
        <p className="text-xl font-bold text-center">{question?.text}</p>

        {/* Answers */}
        <div className="grid grid-cols-2 gap-3 flex-1 content-start">
          {question?.answers.map((a, i) => (
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
              <span className="text-sm text-center leading-tight">{a}</span>
            </button>
          ))}
        </div>

        {phase === 'answered' && (
          <p className="text-center text-gray-400 text-sm animate-pulse">Čekám na výsledek…</p>
        )}
      </div>
    );
  }

  if (phase === 'reveal') {
    const myScore = scores.find((s) => s.name === name);
    const correct = selectedAnswer === correctAnswer;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className={`text-6xl ${correct ? '' : ''}`}>{correct ? '✅' : '❌'}</div>
        <p className="text-2xl font-bold">{correct ? 'Správně!' : 'Bohužel…'}</p>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span>Správná odpověď:</span>
          <span className="font-bold text-white">
            {ANSWER_LABELS[correctAnswer]} – {question?.answers[correctAnswer]}
          </span>
        </div>
        {myScore && (
          <div className="text-3xl font-extrabold text-brand">{myScore.score} b.</div>
        )}
        <p className="text-gray-500 text-sm animate-pulse">Čekej na další otázku…</p>
      </div>
    );
  }

  if (phase === 'finished') {
    const rank = scores.findIndex((s) => s.name === name) + 1;
    const myScore = scores.find((s) => s.name === name);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 max-w-sm mx-auto">
        <h2 className="text-4xl font-extrabold">Konec hry! 🎉</h2>
        <div className="text-2xl font-bold text-brand">
          {rank}. místo – {myScore?.score ?? 0} b.
        </div>
        <div className="w-full bg-gray-900 rounded-2xl p-6 flex flex-col gap-2">
          {scores.map((s, i) => (
            <div key={i} className={`flex justify-between ${s.name === name ? 'text-brand-light font-bold' : 'text-gray-300'}`}>
              <span>{i + 1}. {s.name}</span>
              <span>{s.score} b.</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/')} className="bg-brand hover:bg-brand-dark rounded-xl py-3 px-8 font-bold transition-colors">
          Hrát znovu
        </button>
      </div>
    );
  }
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
