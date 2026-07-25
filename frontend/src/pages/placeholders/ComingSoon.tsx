interface ComingSoonProps {
  title: string;
}

function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16' }}>{title}</h1>
      <p style={{ color: '#5B5347', fontSize: '14px' }}>Coming soon.</p>
    </div>
  );
}

export default ComingSoon;
