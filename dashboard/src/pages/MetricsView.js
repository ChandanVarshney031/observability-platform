import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function MetricsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/metrics?window=1h`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading metrics...</div>;
  }

  // Group metrics by service
  const metricsByService = {};
  data?.metrics?.forEach((m) => {
    if (!metricsByService[m.ServiceName]) {
      metricsByService[m.ServiceName] = [];
    }
    metricsByService[m.ServiceName].push(m);
  });

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Metrics</h2>

      {Object.entries(metricsByService).map(([service, metrics]) => (
        <div key={service} className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-white mb-4">{service}</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Latency percentiles */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Latency Percentiles (ms)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="MinuteStr"
                    tick={{ fill: '#cbd5e1', fontSize: 12 }}
                    angle={-45}
                  />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="p50_ms"
                    stroke="#10b981"
                    name="P50"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="p95_ms"
                    stroke="#f59e0b"
                    name="P95"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="p99_ms"
                    stroke="#ef4444"
                    name="P99"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Error rate */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Error Rate (%)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="MinuteStr"
                    tick={{ fill: '#cbd5e1', fontSize: 12 }}
                    angle={-45}
                  />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                  <Area
                    type="monotone"
                    dataKey="error_rate_pct"
                    fill="#ef4444"
                    stroke="#dc2626"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
