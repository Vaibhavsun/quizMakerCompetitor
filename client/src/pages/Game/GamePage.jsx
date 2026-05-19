import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectSocket, disconnectSocket } from "../../lib/socket.js";
import { getUser } from "../../lib/auth.js";

const DEFAULT_TIME_LIMIT = 10000;
const ROUND_RESULT_DURATION_MS = 3000;

export default function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [phase, setPhase] = useState("connecting"); // connecting | waiting | playing | ended
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT);
  const [remainingMs, setRemainingMs] = useState(DEFAULT_TIME_LIMIT);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [opponentLeft, setOpponentLeft] = useState(null);
  const [error, setError] = useState(null);

  // roundResult: { correctAnswer, players: [{userId, chosenOption, correct, score}] }
  const [roundResult, setRoundResult] = useState(null);

  const tickRef = useRef(null);
  const socketRef = useRef(null);
  const roundPauseRef = useRef(null);   // setTimeout handle for the 3s pause
  const pendingNextRef = useRef(null);  // queued send-question payload while paused
  const pendingEndRef = useRef(null);   // queued game-ended payload while paused

  // --- socket lifecycle -----------------------------------------------------
  useEffect(() => {
    if (!user || !roomId) return;

    const socket = connectSocket({ userId: user.id, roomId });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", roomId, (res) => {
        if (res?.error) {
          setError(res.error);
          setPhase("ended");
          return;
        }
        if (res?.resumed) return;   // game-resumed handler takes over
        if (res?.rejoined) return;  // rejoin path: start-game already applied
        // Only fall back to "waiting" if a game event hasn't already promoted
        // us — start-game can arrive before this ack and we don't want to undo it.
        setPhase((prev) => (prev === "connecting" ? "waiting" : prev));
      });
    });

    socket.on("connect_error", (err) => {
      setError(err.message || "Socket connection failed");
      setPhase("ended");
    });

    socket.on("start-game", (payload) => {
      applyQuestion(payload?.questions, payload?.timeLimit ?? DEFAULT_TIME_LIMIT);
      setPhase("playing");
    });

    socket.on("send-question", (payload) => {
      // If a round result is still being displayed, queue the next question
      // so it doesn't yank the user out of the result view.
      if (roundPauseRef.current) {
        pendingNextRef.current = payload;
        return;
      }
      applyQuestion(payload?.question, payload?.timeLimit ?? DEFAULT_TIME_LIMIT);
      setPhase("playing");
    });

    socket.on("round-result", (payload) => {
      stopTimer();
      setRoundResult({
        correctAnswer: payload?.correctAnswer ?? null,
        players: Array.isArray(payload?.players) ? payload.players : [],
      });
      // Update local score from our row, if present.
      if (Array.isArray(payload?.players)) {
        const mine = payload.players.find((p) => p.userId === user?.id);
        if (mine && typeof mine.score === "number") setScore(mine.score);
      }
      // Clear any stale pause and start a fresh one.
      if (roundPauseRef.current) clearTimeout(roundPauseRef.current);
      roundPauseRef.current = setTimeout(() => {
        roundPauseRef.current = null;
        setRoundResult(null);
        // Flush whichever event arrived during the pause.
        if (pendingEndRef.current) {
          const end = pendingEndRef.current;
          pendingEndRef.current = null;
          pendingNextRef.current = null;
          finishGame(end);
        } else if (pendingNextRef.current) {
          const next = pendingNextRef.current;
          pendingNextRef.current = null;
          applyQuestion(next?.question, next?.timeLimit ?? DEFAULT_TIME_LIMIT);
          setPhase("playing");
        }
      }, ROUND_RESULT_DURATION_MS);
    });

    socket.on("opponent-left", (payload) => {
      setOpponentLeft({ reconnectWindowMs: payload?.reconnectWindowMs ?? 60000 });
    });

    socket.on("game-resumed", (payload) => {
      setOpponentLeft(null);
      if (payload?.question) {
        applyQuestion(payload.question, payload.remainingMs ?? DEFAULT_TIME_LIMIT);
      }
      setPhase("playing");
    });

    socket.on("game-ended", (payload) => {
      // If we're still showing a round result, defer the navigation
      // so the player sees the final round's outcome.
      if (roundPauseRef.current) {
        pendingEndRef.current = payload;
        return;
      }
      finishGame(payload);
    });

    return () => {
      stopTimer();
      if (roundPauseRef.current) {
        clearTimeout(roundPauseRef.current);
        roundPauseRef.current = null;
      }
      pendingNextRef.current = null;
      pendingEndRef.current = null;
      disconnectSocket();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // --- helpers --------------------------------------------------------------
  function applyQuestion(payload, limit) {
    if (!payload) return;
    setQuestion(payload.question ?? null);
    setQuestionIndex(payload.questionIndex ?? 0);
    setTotalQuestions(payload.totalQuestions ?? 0);
    setTimeLimit(limit);
    setSelected(null);
    setRoundResult(null);
    startTimer(limit);
  }

  function finishGame(payload) {
    setPhase("ended");
    stopTimer();
    navigate(`/rooms/${roomId}/results`, {
      replace: true,
      state: {
        scores: Array.isArray(payload?.scores) ? payload.scores : [],
        winnerUserId: payload?.winnerUserId ?? null,
        tie: !!payload?.tie,
        reason: payload?.reason ?? null,
        message: payload?.message ?? null,
      },
    });
  }

  function startTimer(durationMs) {
    stopTimer();
    setRemainingMs(durationMs);
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - startedAt));
      setRemainingMs(left);
      if (left === 0) stopTimer();
    }, 100);
  }

  function stopTimer() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function submit(idx) {
    if (selected !== null || !socketRef.current) return;
    setSelected(idx);
    socketRef.current.emit(
      "submit-answer",
      { roomId, questionIndex, chosenOption: idx },
      (res) => {
        if (res?.error) setError(res.error);
        // Real correctness comes via the round-result event;
        // until then the UI shows "Waiting for opponent…".
      }
    );
  }

  // --- render ---------------------------------------------------------------
  const progress = totalQuestions
    ? Math.min(100, ((questionIndex + 1) / totalQuestions) * 100)
    : 0;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="flex items-center justify-between text-sm text-slate-400">
          <div>
            Room <span className="font-mono text-slate-200">{roomId}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              Score: <span className="font-semibold text-violet-300">{score}</span>
            </span>
            <button
              onClick={() => navigate("/")}
              className="rounded-md border border-white/10 px-2 py-1 hover:bg-slate-900/60"
            >
              Leave
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {phase === "connecting" && <Status text="Connecting…" />}
        {phase === "waiting" && (
          <WaitingPanel roomId={roomId} />
        )}

        {phase === "playing" && question && (
          <>
            <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
              <span>
                Question {questionIndex + 1} of {totalQuestions || "?"}
              </span>
              <span>{seconds}s left</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-[width] duration-100"
                style={{ width: `${(remainingMs / timeLimit) * 100}%` }}
              />
            </div>

            <h2 className="mt-8 text-2xl font-semibold leading-snug">
              {question.question}
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {question.options?.map((opt, i) => {
                const isSelected = selected === i;
                const showResult = roundResult !== null;
                const isCorrectAnswer = showResult && roundResult.correctAnswer === opt;
                const isWrongPick = showResult && isSelected && !isCorrectAnswer;

                let cls =
                  "rounded-xl border p-4 text-left transition disabled:cursor-not-allowed";
                if (isCorrectAnswer) {
                  cls += " border-emerald-400/60 bg-emerald-500/15 text-emerald-100";
                } else if (isWrongPick) {
                  cls += " border-red-400/60 bg-red-500/15 text-red-100";
                } else if (isSelected) {
                  cls += " border-violet-400/60 bg-violet-500/10";
                } else {
                  cls +=
                    " border-white/10 bg-slate-900/40 hover:border-violet-400/40 hover:bg-slate-900/60";
                }

                return (
                  <button
                    key={i}
                    disabled={selected !== null || remainingMs === 0 || roundResult !== null}
                    onClick={() => submit(i)}
                    className={cls}
                  >
                    <span className="mr-2 text-xs text-slate-400">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 min-h-[1.5rem] text-sm">
              {roundResult ? (
                <RoundResultLine
                  correctAnswer={roundResult.correctAnswer}
                  myUserId={user?.id}
                  players={roundResult.players}
                />
              ) : selected !== null ? (
                <span className="text-slate-400">Answer locked in. Waiting for opponent…</span>
              ) : null}
            </div>
          </>
        )}

        {progress > 0 && phase === "playing" && (
          <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full bg-slate-600"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {opponentLeft && phase !== "ended" && (
          <OpponentLeftOverlay reconnectWindowMs={opponentLeft.reconnectWindowMs} />
        )}
      </div>
    </main>
  );
}

function Status({ text }) {
  return (
    <div className="mt-16 text-center text-slate-400">{text}</div>
  );
}

function RoundResultLine({ correctAnswer, myUserId, players }) {
  const me = players.find((p) => p.userId === myUserId);
  const opp = players.find((p) => p.userId !== myUserId);
  return (
    <div className="space-y-1">
      <div>
        Correct answer:{" "}
        <span className="font-semibold text-emerald-300">{correctAnswer ?? "—"}</span>
      </div>
      <div className="text-xs text-slate-400">
        You: {me ? (me.correct ? "✓ correct" : "✗ wrong") : "no answer"}
        {opp && ` · Opponent: ${opp.correct ? "✓ correct" : "✗ wrong"}`}
      </div>
    </div>
  );
}

function WaitingPanel({ roomId }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center">
      <h2 className="text-xl font-semibold">Waiting for an opponent…</h2>
      <p className="mt-2 text-sm text-slate-300">
        Share this room ID. The game starts as soon as a second player joins.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <code className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 font-mono text-violet-300">
          {roomId}
        </code>
        <button
          onClick={copy}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-slate-900/60"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function OpponentLeftOverlay({ reconnectWindowMs }) {
  const [remaining, setRemaining] = useState(reconnectWindowMs);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      const left = Math.max(0, reconnectWindowMs - (Date.now() - started));
      setRemaining(left);
    }, 250);
    return () => clearInterval(t);
  }, [reconnectWindowMs]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[360px] rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
        <h3 className="text-lg font-semibold">Opponent disconnected</h3>
        <p className="mt-2 text-sm text-slate-300">
          Waiting up to {Math.ceil(remaining / 1000)}s for them to return…
        </p>
      </div>
    </div>
  );
}
