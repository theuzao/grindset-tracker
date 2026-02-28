import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './app/Router';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
