import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RoutineDetailPage } from './features/routines/RoutineDetailPage';
import { RoutineEditorPage } from './features/routines/RoutineEditorPage';
import { RoutinesPage } from './features/routines/RoutinesPage';
import { TodayPage } from './features/routines/TodayPage';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { user } = useAuth();
  if (user === undefined) return <div className="splash" aria-busy="true" />;
  if (user === null) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="routines" element={<RoutinesPage />} />
        <Route path="routines/new" element={<RoutineEditorPage />} />
        <Route path="routines/:id" element={<RoutineDetailPage />} />
        <Route path="routines/:id/edit" element={<RoutineEditorPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
