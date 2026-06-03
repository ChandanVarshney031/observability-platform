import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Network, TrendingUp } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Observability Platform</h1>
        </div>
        <div className="flex gap-6">
          <Link
            to="/traces"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition"
          >
            <Activity className="w-4 h-4" />
            Traces
          </Link>
          <Link
            to="/services"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition"
          >
            <Network className="w-4 h-4" />
            Services
          </Link>
          <Link
            to="/metrics"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition"
          >
            <TrendingUp className="w-4 h-4" />
            Metrics
          </Link>
        </div>
      </div>
    </nav>
  );
}
