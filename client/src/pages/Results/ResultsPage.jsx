import { Link, useLocation, useParams } from "react-router-dom";
import { getUser } from "../../lib/auth.js";

export default function ResultsPage() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const user = getUser();

  const scores = Array.isArray(state?.scores) ? state.scores : [];
  const reason = state?.reason;
  const winnerUserId = state?.winnerUserId;
  const tie = !!state?.tie;
  const message = state?.message;

  const myUserId = user?.id;
  const youWon = !tie && winnerUserId && winnerUserId === myUserId;
  const opponentWalkout = reason === "opponent-timeout";

  // Sort scores: yours first if present, otherwise descending.
  const sortedScores = [...scores].sort((a, b) => {
    if (a.userId === myUserId) return -1;
    if (b.userId === myUserId) return 1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  const myEntry = scores.find((s) => s.userId === myUserId);
  const oppEntry = scores.find((s) => s.userId !== myUserId);

  let headline;
  if (tie) {
    headline = "It's a tie";
  } else if (opponentWalkout && youWon) {
    headline = "You win by walkover";
  } else if (youWon) {
    headline = "You win 🎉";
  } else if (winnerUserId && winnerUserId !== myUserId) {
    headline = "You lose";
  } else {
    headline = "Game over";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{headline}</h1>

        {message && (
          <p className="mt-3 text-slate-300">{message}</p>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/40 p-8">
          {sortedScores.length > 0 ? (
            <div className="space-y-3">
              {sortedScores.map((s) => {
                const isYou = s.userId === myUserId;
                const isWinner = !tie && winnerUserId === s.userId;
                return (
                  <div
                    key={s.userId}
                    className={
                      "flex items-center justify-between rounded-lg border px-4 py-3 " +
                      (isWinner
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-white/10 bg-slate-950/40")
                    }
                  >
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-medium">
                        {isYou ? "You" : "Opponent"}
                      </span>
                      {isWinner && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">
                          Winner
                        </span>
                      )}
                      {tie && (
                        <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-200">
                          Tie
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-violet-300">
                      {s.score ?? 0}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-300">Thanks for playing.</p>
          )}

          {(myEntry || oppEntry) && (
            <p className="mt-6 text-xs text-slate-500">
              {myEntry && oppEntry
                ? `Final: ${myEntry.score ?? 0} – ${oppEntry.score ?? 0}`
                : null}
            </p>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Room <span className="font-mono text-slate-300">{roomId}</span>
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/rooms/new"
            className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-600 px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            New room
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2 text-slate-200 hover:bg-slate-900/60"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
