import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    const id = roomId.trim();
    if (!id) return;

    setError(null);
    setLoading(true);
    try {
      await api.getRoom(id);
      navigate(`/rooms/${id}/play`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-md px-6 py-16">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Join a room</h1>
        <p className="mt-2 text-sm text-slate-300">
          Enter the room ID your friend shared with you.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
        >
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
            className="w-full rounded-lg border border-gray-700 bg-gray-900/50 p-3 font-mono text-white focus:border-violet-500 focus:outline-none"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !roomId.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-blue-600 px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Checking…" : "Join room"}
          </button>
        </form>
      </div>
    </main>
  );
}
