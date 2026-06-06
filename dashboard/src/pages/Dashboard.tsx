import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, Clock, Server } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState<any>({
    kpis: { totalRequests: 0, errorRate: 0, p99: 0, activeServices: 0 },
    sparkline: [],
    errors: [],
    insights: []
  });

  const fetchData = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const [metricsRes, insightsRes, tracesRes, servicesRes] = await Promise.all([
        axios.get(`${API_URL}/api/metrics?service=api-gateway&window=1h`).catch(() => ({ data: { p99: 0, errorRate: 0, rpsData: [] } })),
        axios.get(`${API_URL}/api/insights`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/traces?status=error&limit=10`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/services`).catch(() => ({ data: { nodes: [] } }))
      ]);

      const metrics = metricsRes.data;
      const rpsData = metrics.rpsData || [];

      setData({
        kpis: {
          totalRequests: rpsData.reduce((acc: number, val: any) => acc + val.value, 0) || 0,
          errorRate: metrics.errorRate || 0,
          p99: metrics.p99 || 0,
          activeServices: servicesRes.data.nodes?.length || 0,
        },
        sparkline: rpsData,
        errors: tracesRes.data || [],
        insights: insightsRes.data || []
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data.kpis.errorRate.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P99 Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.p99.toFixed(0)} ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.activeServices}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Requests per Minute (Live)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             {data.sparkline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.sparkline}>
                  <Tooltip contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }} />
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
             ) : (
               <div className="flex h-full items-center justify-center text-muted-foreground">Waiting for traffic...</div>
             )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>AI Root Cause Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.insights.length > 0 ? data.insights.slice(0,5).map((insight: any) => (
                <div key={insight.traceId} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-primary">{insight.serviceName}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${insight.severity === 'CRITICAL' ? 'bg-destructive/20 text-destructive' : 'bg-orange-500/20 text-orange-500'}`}>
                      {insight.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{insight.rootCause}</p>
                </div>
              )) : (
                <div className="text-center text-muted-foreground py-8">No recent insights</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors Feed</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
              {data.errors.length > 0 ? data.errors.map((err: any) => (
                <div key={err.traceId} className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-3 last:border-0 gap-2">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{err.traceId.substring(0, 8)}</span>
                    <span className="font-medium">{err.serviceName}</span>
                  </div>
                  <span className="text-sm text-destructive">{err.operationName}</span>
                </div>
              )) : (
                <div className="text-center text-muted-foreground py-8">No recent errors</div>
              )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
