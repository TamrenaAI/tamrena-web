import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { clearToken } from '../../lib/api';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
      </svg>
    ),
  },
  {
    to: '/workout',
    label: 'AI Workout Studio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M12 18v-6"></path>
        <path d="m9 15 3 3 3-3"></path>
      </svg>
    ),
  },
  {
    to: '/nutrition',
    label: 'AI Nutrition & Macros',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20"></path>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    ),
  },
  {
    to: '/progress',
    label: 'Progress & InBody',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    ),
  },
  {
    to: '/exercises',
    label: 'Exercise & CV Coach',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"></path>
        <rect x="2" y="6" width="14" height="12" rx="2"></rect>
      </svg>
    ),
  },
];

function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: '260px',
        minWidth: '260px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100vh',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div>
        {/* Brand Header */}
        <div style={{ padding: '0 8px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#042f2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 6.5h11"></path>
                <path d="M6.5 17.5h11"></path>
                <path d="M12 2v20"></path>
                <circle cx="12" cy="12" r="3" fill="#042f2e"></circle>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                  Tamreena<span style={{ color: '#10b981' }}>-AI</span>
                </span>
                <span className="badge badge-emerald" style={{ padding: '2px 6px', fontSize: '10px' }}>PRO</span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>AI Gym & Performance Core</p>
            </div>
          </div>
        </div>

        {/* Quick Workout CTA */}
        <div style={{ padding: '0 4px', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/intake')}
            className="btn btn-primary"
            style={{ width: '100%', gap: '8px', padding: '12px', fontSize: '13px', borderRadius: '12px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            Generate AI Routine
          </button>
        </div>

        {/* Navigation List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#34d399' : '#94a3b8',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                boxShadow: isActive ? '0 0 15px rgba(16, 185, 129, 0.15)' : 'none',
                transition: 'all 0.2s ease',
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User Profile Card */}
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '15px',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(6, 182, 212, 0.3)',
            }}
          >
            {user?.username ? user.username[0].toUpperCase() : 'A'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.username || 'Athlete'}
            </p>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Active Gym Pro</span>
          </div>
        </div>
        <button
          id="sign-out-btn"
          onClick={() => {
            clearToken();
            window.location.href = '/signin';
          }}
          title="Sign Out"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            color: '#f43f5e',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
