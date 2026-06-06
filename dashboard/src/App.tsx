import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Traces from './pages/Traces';
import Services from './pages/Services';
import Metrics from './pages/Metrics';
import AiInsights from './pages/AiInsights';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/traces" element={<Traces />} />
          <Route path="/services" element={<Services />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/ai-insights" element={<AiInsights />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
