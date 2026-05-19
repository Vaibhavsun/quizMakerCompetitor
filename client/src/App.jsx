import { Navigate, Route, Routes } from "react-router-dom";
import { getUser } from "./lib/auth.js";
import AuthPage from "./pages/Auth/AuthPage.jsx";
import HomePage from "./pages/Home/HomePage.jsx";
import CreateRoomPage from "./pages/Room/CreateRoomPage.jsx";
import JoinRoomPage from "./pages/Room/JoinRoomPage.jsx";
import GamePage from "./pages/Game/GamePage.jsx";
import ResultsPage from "./pages/Results/ResultsPage.jsx";

function RequireAuth({ children }) {
  return getUser() ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms/new"
        element={
          <RequireAuth>
            <CreateRoomPage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms/join"
        element={
          <RequireAuth>
            <JoinRoomPage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms/:roomId/play"
        element={
          <RequireAuth>
            <GamePage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms/:roomId/results"
        element={
          <RequireAuth>
            <ResultsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
