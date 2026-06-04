import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function TraceDetail({ traceId, onClose }) {
  const { data: spans, isLoading } = useQuery({
    queryKey: ['trace', traceId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/traces/${traceId}`);
      return res.data;
    },
  });

  const { data: insight, isLoading: isLoadingInsight } = useQuery({
    queryKey: ['insight', traceId],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_URL}/api/insights/${traceId}`);
        return res.data;
      } catch (e) {
        return null;
      }
    },
    retry: false,
  });

  const spanList = spans?.spans || [];

  if (!spans || spanList.length === 0) {
    return <div className="p-8 text-center text-slate-400 border-t border-slate-700">No spans found for trace.</div>;
  }

  // Calculate waterfall metrics using nanosecond timestamps
  const minStartTime = Math.min(...spanList.map(s => Number(s.StartTimeNano)));
  const maxEndTime = Math.max(...spanList.map(s => Number(s.StartTimeNano) + Number(s.Duration)));
  const totalDuration = maxEndTime - minStartTime || 1;

  // Simple color mapping
  const serviceColors = {
    'api-gateway': 'bg-blue-500',
    'order-service': 'bg-purple-500',
    'payment-service': 'bg-emerald-500',
  };

  return (
    <div className="border-t border-slate-700 bg-slate-800/80 p-6 rounded-b-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Trace Detail: {traceId}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white px-3 py-1 rounded bg-slate-700">Close</button>
      </div>

      {insight && insight.insight && (
        <div className="mb-6 bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold flex items-center gap-2">
                AI Root Cause Analysis
                <span className={`text-xs px-2 py-0.5 rounded ${
                  insight.insight.Severity === 'critical' || insight.insight.Severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {insight.insight.Severity}
                </span>
              </h4>
              <p className="text-slate-300 mt-1">{insight.insight.RootCause}</p>
              {insight.insight.Recommendation && (
                <p className="text-slate-400 mt-2 text-sm"><strong className="text-slate-300">Recommendation:</strong> {insight.insight.Recommendation}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1 relative pt-6 pb-2 border-l border-slate-700 pl-4">
        {/* Timeline header */}
        <div className="absolute top-0 left-0 w-full flex justify-between text-xs text-slate-500 px-4">
          <span>0ms</span>
          <span>{(totalDuration / 1_000_000).toFixed(1)}ms</span>
        </div>

        {isLoading && <div className="absolute inset-0 flex items-center justify-center text-slate-400">Loading trace details...</div>}
        {spanList.map(span => {
          const startOffset = Number(span.StartTimeNano) - minStartTime;
          const leftPct = (startOffset / totalDuration) * 100;
          const widthPct = Math.max((Number(span.Duration) / totalDuration) * 100, 0.5); // min width for visibility
          const colorClass = serviceColors[span.ServiceName] || 'bg-slate-500';

          return (
            <div key={span.SpanId} className="relative h-10 w-full group">
              {/* Span label */}
              <div className="absolute left-0 top-0 w-1/4 pr-4 text-xs flex flex-col justify-center h-full z-10 truncate">
                <span className="text-slate-200 font-medium truncate" title={span.ServiceName}>{span.ServiceName}</span>
                <span className="text-slate-400 truncate" title={span.OperationName}>{span.OperationName}</span>
              </div>
              
              {/* Waterfall bar container */}
              <div className="absolute left-1/4 right-0 top-0 h-full border-l border-slate-700/50 bg-slate-900/20 rounded">
                <div 
                  className={`absolute top-2 h-6 rounded ${colorClass} opacity-80 group-hover:opacity-100 transition-opacity flex items-center px-2 cursor-help`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  {span.StatusCode === 2 && <AlertCircle className="w-3 h-3 text-red-200 absolute -left-4" />}
                </div>
              </div>
              
              {/* Tooltip on hover */}
              <div className="hidden group-hover:block absolute left-1/4 top-10 z-50 bg-slate-800 border border-slate-600 p-3 rounded shadow-xl text-xs w-96 break-all">
                <div className="font-semibold text-white mb-2">{span.OperationName} ({(Number(span.Duration) / 1_000_000).toFixed(2)}ms)</div>
                <div className="text-slate-400 mb-2">Span ID: {span.SpanId}</div>
                <div className="text-slate-300 whitespace-pre-wrap">{JSON.stringify(span.Attributes || {}, null, 2)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TraceExplorer() {
  const [filters, setFilters] = useState({
    service: '',
    status: 'all',
    limit: 100,
    from: '',
    to: '',
  });

  const [selectedTrace, setSelectedTrace] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['traces', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(filters.service && { service: filters.service }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.from && { from: new Date(filters.from).getTime() }),
        ...(filters.to && { to: new Date(filters.to).getTime() }),
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
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Service</label>
            <input
              type="text"
              placeholder="Filter by service"
              value={filters.service}
              onChange={(e) => setFilters({ ...filters, service: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
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
            <label className="block text-sm font-medium text-slate-300 mb-2">From</label>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">To</label>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Limit</label>
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
                <React.Fragment key={trace.TraceId}>
                  <tr 
                    className={`transition cursor-pointer ${selectedTrace === trace.TraceId ? 'bg-slate-700' : 'hover:bg-slate-700/50'}`}
                    onClick={() => setSelectedTrace(selectedTrace === trace.TraceId ? null : trace.TraceId)}
                  >
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
                  {selectedTrace === trace.TraceId && (
                    <tr>
                      <td colSpan="6" className="p-0">
                        <TraceDetail traceId={trace.TraceId} onClose={() => setSelectedTrace(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
