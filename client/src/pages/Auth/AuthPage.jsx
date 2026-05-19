import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../../components/cards/AuthCard.jsx";
import { api } from "../../lib/api.js";
import { saveUser } from "../../lib/auth.js";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit({ email, password }) {
    setError(null);
    setLoading(true);
    try {
      const result = isLogin
        ? await api.login(email, password)
        : await api.register(email, password);
      saveUser(result.user);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative mx-auto min-h-screen max-w-6xl px-6 py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-20%,rgba(168,85,247,0.20),transparent_60%),radial-gradient(1000px_circle_at_18%_95%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_90%_55%,rgba(34,211,238,0.10),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative grid min-h-[calc(100vh-8rem)] items-center gap-12 lg:grid-cols-2">
          <div className="hidden lg:block">
            <div className="max-w-xl">
              <p className="text-sm font-semibold tracking-wider text-violet-200/90">
                QUIZ COMPETITION MAKER
              </p>
              <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-50">
                Build quizzes.
                <span className="block bg-gradient-to-r from-violet-300 via-indigo-300 to-cyan-200 bg-clip-text text-transparent">
                  Compete in style.
                </span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-300">
                Generate an AI-powered quiz, share the room with a friend, and
                race to answer in real time.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <AuthCard
              isLogin={isLogin}
              onToggle={(next) => setIsLogin(next)}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
