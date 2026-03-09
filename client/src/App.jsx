import { Routes, Route, Navigate } from 'react-router-dom';
import JoinPage from './pages/JoinPage.jsx';
import HostPage from './pages/HostPage.jsx';
import PlayPage from './pages/PlayPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
