import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import Sidebar from './Sidebar';

function ProtectedLayout() {
  const { loading } = useAuth();

  if (!getToken()) {
    return <Navigate to="/signin" replace />;
  }
  if (loading) {
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F7F3EC' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default ProtectedLayout;
