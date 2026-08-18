import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Destinations from './pages/Destinations.jsx';
import Plan from './pages/Plan.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Checking your session" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/plan"
            element={
              <RequireAuth>
                <Plan />
              </RequireAuth>
            }
          />
          <Route
            path="/destinations"
            element={
              <RequireAuth>
                <Destinations />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
