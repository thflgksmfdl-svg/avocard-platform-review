import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './state/authStore';
import { AppRouter } from './router';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
