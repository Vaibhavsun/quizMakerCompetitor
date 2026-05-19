import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { getUser } from "../../lib/auth.js";

export default function CreateRoomPage() {
  const user = getUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { topic: "", difficulty: "medium", description: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.createRoom({ userId: user.id, ...values });
      // server returns { data: { url: "/room/<id>", quiz } }
      const url = res?.data?.url || "";
      const roomId = url.split("/").pop();
      if (!roomId) throw new Error("Room ID missing from response");
      navigate(`/rooms/${roomId}/play`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Create a quiz room
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          The AI agent generates 10 multiple-choice questions tailored to your
          topic.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
        >
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Topic
            </label>
            <input
              {...register("topic", {
                required: "Topic is required",
                minLength: { value: 3, message: "Min 3 characters" },
                maxLength: { value: 200, message: "Too long" },
              })}
              placeholder="e.g. Solar System"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-white focus:border-violet-500 focus:outline-none"
            />
            {errors.topic && (
              <p className="mt-1 text-sm text-red-400">{errors.topic.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">
              Difficulty
            </label>
            <select
              {...register("difficulty", { required: true })}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">
              Description
            </label>
            <textarea
              rows={4}
              {...register("description", {
                required: "Describe what the quiz should cover",
              })}
              placeholder="A short description of the subject matter for the AI agent."
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-white focus:border-violet-500 focus:outline-none"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-400">
                {errors.description.message}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-blue-600 px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Generating quiz…" : "Create room"}
          </button>
        </form>
      </div>
    </main>
  );
}
