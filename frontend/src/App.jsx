import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import AdminPanel from './pages/AdminPanel';
import ChangePassword from './pages/ChangePassword';
import MyCourses from './pages/MyCourses';
import CourseViewer from './pages/CourseViewer';
import QuizViewer from './pages/QuizViewer';
import Navbar from './components/Navbar';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, token, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading...</div>;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/welcome" replace />;
  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <>
      {token && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/my-courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
        <Route path="/my-courses/:assignmentId" element={<ProtectedRoute><CourseViewer /></ProtectedRoute>} />
        <Route path="/quiz/:assignmentId" element={<ProtectedRoute><QuizViewer /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={token ? '/welcome' : '/login'} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
