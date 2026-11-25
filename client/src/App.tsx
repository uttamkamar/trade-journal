import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Trades } from './pages/Trades';
import { Journal } from './pages/Journal';
import { Performance } from './pages/Performance';
import { Mistakes } from './pages/Mistakes';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/trades/new" element={<Trades />} />
            <Route path="/trades/:id" element={<Trades />} />
            <Route path="/trades/:id/edit" element={<Trades />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:date" element={<Journal />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
