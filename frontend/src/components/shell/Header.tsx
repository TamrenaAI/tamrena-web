import { useLocation } from 'react-router-dom';

function getHeaderTitle(pathname: string): { title: string; subtitle: string } {
  if (pathname === '/') return { title: 'Gym Command Center', subtitle: 'Overview of your workout plan, macros, and muscle analytics' };
  if (pathname.startsWith('/workout')) return { title: 'AI Workout Studio', subtitle: 'Personalized progressive routines powered by Tamreena-AI engine' };
  if (pathname.startsWith('/nutrition')) return { title: 'AI Nutrition & Macros', subtitle: 'Targeted caloric breakdown and custom dataset meal plans' };
  if (pathname.startsWith('/progress')) return { title: 'Progress & InBody', subtitle: 'Body composition trends, muscle asymmetry & scan history' };
  if (pathname.startsWith('/exercises')) return { title: 'Exercise Directory & CV Coach', subtitle: 'Pose check library and live computer vision rep tracker' };
  if (pathname.startsWith('/coach')) return { title: 'AI Coach Chat', subtitle: 'Ask about your training and nutrition plan' };
  return { title: 'Tamreena-AI', subtitle: 'Your Intelligent Fitness Assistant' };
}

function Header() {
  const location = useLocation();
  const { title, subtitle } = getHeaderTitle(location.pathname);

  return (
    <header
      style={{
        height: '70px',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Streak Pill */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '9999px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#fbbf24',
          }}
        >
          <span>🔥</span>
          <span>5 Day Streak</span>
        </div>

        {/* AI System Status */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '9999px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#34d399',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 10px #10b981',
            }}
          />
          AI Core Online
        </div>
      </div>
    </header>
  );
}

export default Header;
