import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navbar from './components/Navbar';
import TraceExplorer from './pages/TraceExplorer';
import ServiceGraph from './pages/ServiceGraph';
import MetricsView from './pages/MetricsView';
import AIInsightsSidebar from './components/AIInsightsSidebar';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-900 flex flex-col">
          <Navbar />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/" element={<TraceExplorer />} />
                <Route path="/traces" element={<TraceExplorer />} />
                <Route path="/services" element={<ServiceGraph />} />
                <Route path="/metrics" element={<MetricsView />} />
              </Routes>
            </main>
            <AIInsightsSidebar />
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
