import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { clearToken } from '../../lib/api';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/workout', label: 'Workout' },
  { to: '/progress', label: 'Progress' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/nutrition', label: 'Nutrition' },
];

function linkStyle(isActive: boolean) {
  return {
    display: 'block',
    padding: '10px 16px',
    borderRadius: '10px',
    marginBottom: '4px',
    textDecoration: 'none',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? '#B5502E' : '#5B5347',
    backgroundColor: isActive ? '#F2E2CC' : 'transparent',
  };
}

function Sidebar() {
  const { user } = useAuth();

  return (
    <aside
      style={{
        width: '220px',
        borderRight: '1px solid #E2DACB',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} style={({ isActive }) => linkStyle(isActive)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div>
        {user && <p style={{ fontSize: '12px', color: '#5B5347', marginBottom: '8px' }}>{user.username}</p>}
        <button
          id="sign-out-btn"
          onClick={() => {
            clearToken();
            window.location.href = '/signin';
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#8C6F52',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
