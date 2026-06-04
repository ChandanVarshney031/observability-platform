import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, AlertTriangle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function MetricsView() {
  const [timeWindow, setTimeWindow] = useState('1h');
  const [selectedService, setSelectedService] = useState('all');

  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['metrics', timeWindow, selectedService],
    queryFn: async () => {
      const params = new URLSearchParams({ window: timeWindow });
      if (selectedService !== 'all') {
        params.append('service', selectedService);
      }
      const res = await axios.get(`${API_URL}/api/metrics?${params}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: alertsData, isLoading: isLoadingAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/alerts`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const metricsByService = {};
  metricsData?.metrics?.forEach((m) => {
    if (!metricsByService[m.ServiceName]) {
      metricsByService[m.ServiceName] = [];
    }
    metricsByService[m.ServiceName].push(m);
  });

  const servicesList = ['api-gateway', 'order-service', 'payment-service'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Metrics</h2>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
          >
            <option value="all">All Services</option>
            {servicesList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <div className="flex bg-slate-700 rounded overflow-hidden border border-slate-600">
            {['1h', '6h', '24h'].map(w => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-4 py-2 text-sm ${timeWindow === w ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoadingMetrics ? (
        <div className="text-center py-8 text-slate-400">Loading metrics...</div>
      ) : (
        Object.entries(metricsByService).map(([service, metrics]) => (
          <div key={service} className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-xl font-semibold text-white mb-4">{service}</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Latency Percentiles (ms)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="MinuteStr" tick={{ fill: '#cbd5e1', fontSize: 12 }} angle={-45} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                    <Legend />
                    <Line type="monotone" dataKey="p50_ms" stroke="#10b981" name="P50" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="p95_ms" stroke="#f59e0b" name="P95" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="p99_ms" stroke="#ef4444" name="P99" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Request Rate (req/min)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="MinuteStr" tick={{ fill: '#cbd5e1', fontSize: 12 }} angle={-45} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                    <Area type="monotone" dataKey="total_requests" fill="#3b82f6" stroke="#2563eb" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Error Rate (%)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="MinuteStr" tick={{ fill: '#cbd5e1', fontSize: 12 }} angle={-45} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                    <Area type="monotone" dataKey="error_rate_pct" fill="#ef4444" stroke="#dc2626" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ))
      )}

      <div className="bg-slate-800 rounded-lg p-4 mt-8">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          Active Anomalies & Alerts
        </h3>
        
        {isLoadingAlerts ? (
          <div className="text-slate-400">Loading alerts...</div>
        ) : alertsData?.alerts && alertsData.alerts.length > 0 ? (
          <div className="space-y-2">
            {alertsData.alerts.map((alert, idx) => (
              <div key={idx} className="bg-slate-700 border border-slate-600 rounded p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="text-white font-medium">{alert.ServiceName}</span>
                  <span className="text-slate-300">
                    p99 latency: <strong className="text-red-400">{Number(alert.p99_ms).toFixed(0)}ms</strong>
                    {' '}| error rate: <strong className="text-amber-400">{Number(alert.error_rate_pct).toFixed(1)}%</strong>
                  </span>
                </div>
                <span className="text-slate-400 text-sm">{alert.MinuteStr}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 bg-slate-700 p-4 rounded text-center">
            No active anomalies detected in the current window.
          </div>
        )}
      </div>
    </div>
  );
}
