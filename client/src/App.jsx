import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import JoinPage from './pages/JoinPage.jsx';
import HostPage from './pages/HostPage.jsx';
import PlayPage from './pages/PlayPage.jsx';
import GoldRushHostPage from './pages/GoldRushHostPage.jsx';
import GoldRushPlayPage from './pages/GoldRushPlayPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/host/goldrush" element={<GoldRushHostPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/play/goldrush" element={<GoldRushPlayPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
