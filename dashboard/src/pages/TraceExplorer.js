import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function TraceExplorer() {
  const [filters, setFilters] = useState({
    service: '',
    status: 'all',
    limit: 100,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['traces', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(filters.service && { service: filters.service }),
        ...(filters.status !== 'all' && { status: filters.status }),
        limit: filters.limit,
      });
      const res = await axios.get(`${API_URL}/api/traces?${params}`);
      return res.data;
    },
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Trace Explorer</h2>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Service
            </label>
            <input
              type="text"
              placeholder="Filter by service"
              value={filters.service}
              onChange={(e) => setFilters({ ...filters, service: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            >
              <option value="all">All</option>
              <option value="ok">Success</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Limit
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading traces...</div>
      ) : error ? (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
          Error loading traces: {error.message}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Trace ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Service</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Operation</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Duration (ms)</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {data?.traces?.map((trace) => (
                <tr key={trace.TraceId} className="hover:bg-slate-700 transition">
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                    {trace.TraceId.substring(0, 12)}...
                  </td>
                  <td className="px-4 py-3 text-slate-300">{trace.ServiceName}</td>
                  <td className="px-4 py-3 text-slate-300">{trace.OperationName}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {(trace.DurationMs || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {trace.StatusCode === 2 ? (
                      <span className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        Error
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{trace.StartTimeStr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-slate-700 text-slate-300 text-sm">
            Showing {data?.count || 0} traces
          </div>
        </div>
      )}
    </div>
  );
}
