import { useForm } from "react-hook-form";

export default function AuthCard({ isLogin, onToggle, onSubmit, loading, error }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const submit = handleSubmit((data) => onSubmit(data));

  return (
    <div className="w-[380px] p-6 rounded-2xl shadow-2xl backdrop-blur-lg bg-gradient-to-br from-violet-600/20 to-blue-900/30 border border-white/10">
      <div className="flex mb-6 bg-gray-800/40 rounded-xl p-1">
        <button
          type="button"
          onClick={() => onToggle(true)}
          className={`w-1/2 py-2 rounded-lg text-sm font-semibold transition ${
            isLogin
              ? "bg-gradient-to-r from-violet-500 to-blue-600 text-white"
              : "text-gray-300"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className={`w-1/2 py-2 rounded-lg text-sm font-semibold transition ${
            !isLogin
              ? "bg-gradient-to-r from-violet-500 to-blue-600 text-white"
              : "text-gray-300"
          }`}
        >
          Sign Up
        </button>
      </div>

      <h2 className="text-2xl font-bold text-white text-center mb-4">
        {isLogin ? "Welcome Back" : "Create Account"}
      </h2>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <input
            type="email"
            placeholder="Email"
            {...register("email", {
              required: "Email is required",
              pattern: { value: /^\S+@\S+$/i, message: "Invalid email" },
            })}
            className="w-full p-3 rounded-lg bg-gray-900/50 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
          />
          {errors.email && (
            <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <input
            type="password"
            placeholder="Password"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 6, message: "Min 6 characters" },
            })}
            className="w-full p-3 rounded-lg bg-gray-900/50 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
          />
          {errors.password && (
            <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-violet-500 to-blue-600 hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Please wait…" : isLogin ? "Login" : "Sign Up"}
        </button>
      </form>

      <p className="text-gray-400 text-sm text-center mt-4">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <span
          onClick={() => onToggle(!isLogin)}
          className="text-violet-400 ml-1 cursor-pointer hover:underline"
        >
          {isLogin ? "Sign Up" : "Login"}
        </span>
      </p>
    </div>
  );
}
