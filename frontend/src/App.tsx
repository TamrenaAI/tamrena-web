import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import AuthScreen from './pages/AuthScreen';
import ProtectedLayout from './components/shell/ProtectedLayout';
import Home from './pages/Home';
import WorkoutTab from './pages/workout/WorkoutTab';
import PlanView from './pages/workout/PlanView';
import IntakeFlow from './pages/intake/IntakeFlow';
import CaptureScreen from './pages/CaptureScreen';
import ProcessingScreen from './pages/ProcessingScreen';
import ComingSoon from './pages/placeholders/ComingSoon';

function SignInRoute() {
  const navigate = useNavigate();
  return <AuthScreen onSignedIn={() => navigate('/')} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/signin" element={<SignInRoute />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/workout" element={<WorkoutTab />} />
            <Route path="/workout/:sessionId" element={<PlanView />} />
            <Route path="/progress" element={<ComingSoon title="Progress" />} />
            <Route path="/exercises" element={<ComingSoon title="Exercises" />} />
            <Route path="/nutrition" element={<ComingSoon title="Nutrition" />} />
          </Route>
          <Route path="/intake" element={<IntakeFlow />} />
          <Route path="/capture" element={<CaptureScreen />} />
          <Route path="/processing" element={<ProcessingScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
