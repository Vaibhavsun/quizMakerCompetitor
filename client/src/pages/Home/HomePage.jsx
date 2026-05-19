import { Link, useNavigate } from "react-router-dom";
import { clearUser, getUser } from "../../lib/auth.js";

export default function HomePage() {
  const user = getUser();
  const navigate = useNavigate();

  function logout() {
    clearUser();
    navigate("/auth", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative mx-auto max-w-4xl px-6 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_circle_at_30%_20%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(168,85,247,0.10),transparent_55%)]" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Quiz Competition Maker
            </h1>
            <p className="mt-3 text-slate-300">
              Signed in as{" "}
              <span className="font-mono text-violet-300">{user?.email}</span>
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/60"
          >
            Sign out
          </button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            to="/rooms/new"
            className="group rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-blue-900/20 p-6 hover:border-violet-400/40"
          >
            <h3 className="text-xl font-semibold">Create a room</h3>
            <p className="mt-2 text-sm text-slate-300">
              Generate an AI quiz from a topic and difficulty, then invite a
              friend.
            </p>
            <span className="mt-4 inline-block text-violet-300 group-hover:text-violet-200">
              New room →
            </span>
          </Link>

          <Link
            to="/rooms/join"
            className="group rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-600/15 to-indigo-900/20 p-6 hover:border-cyan-300/40"
          >
            <h3 className="text-xl font-semibold">Join a room</h3>
            <p className="mt-2 text-sm text-slate-300">
              Paste a room ID someone shared with you and jump in.
            </p>
            <span className="mt-4 inline-block text-cyan-300 group-hover:text-cyan-200">
              Join →
            </span>
          </Link>
        </div>

        <p className="mt-10 text-xs text-slate-500">
          Your user ID:{" "}
          <span className="font-mono text-slate-400">{user?.id}</span>
        </p>
      </div>
    </main>
  );
}
