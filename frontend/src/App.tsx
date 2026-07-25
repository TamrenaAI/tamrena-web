import { useState } from 'react';
import SignIn from './pages/SignIn';
import { getToken } from './lib/api';

function App() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken()));

  if (!signedIn) {
    return <SignIn onSignedIn={() => setSignedIn(true)} />;
  }

  return <div>Signed in — Home page comes in a later stage.</div>;
}

export default App;
