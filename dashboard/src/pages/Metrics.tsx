import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const dummyData = Array.from({ length: 60 }).map((_, i) => ({
  time: `10:${i < 10 ? '0'+i : i}`,
  p50: Math.random() * 50 + 20,
  p95: Math.random() * 80 + 50,
  p99: Math.random() * 150 + 100,
  rps: Math.random() * 10 + 5,
  errors: Math.random() < 0.1 ? Math.random() * 2 : 0
}));

export default function Metrics() {
  const [service, setService] = useState('api-gateway');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-bold tracking-tight">System Metrics</h2>
        <select 
          className="bg-card border border-border text-sm rounded-md px-4 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="api-gateway">api-gateway</option>
          <option value="order-service">order-service</option>
          <option value="payment-service">payment-service</option>
          <option value="inventory-service">inventory-service</option>
          <option value="notification-service">notification-service</option>
        </select>
      </div>

      <Tabs defaultValue="1h" className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="1h">Last 1 Hour</TabsTrigger>
          <TabsTrigger value="6h">Last 6 Hours</TabsTrigger>
          <TabsTrigger value="24h">Last 24 Hours</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Latency Percentiles (ms)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dummyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }} />
                <Area type="monotone" dataKey="p99" stroke="#ef4444" fillOpacity={1} fill="url(#colorP99)" />
                <Area type="monotone" dataKey="p95" stroke="#f59e0b" fillOpacity={1} fill="url(#colorP95)" />
                <Area type="monotone" dataKey="p50" stroke="#3b82f6" fillOpacity={1} fill="url(#colorP50)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Requests per Second</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dummyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} hide />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }} />
                  <Area type="step" dataKey="rps" stroke="#10b981" fillOpacity={0.1} fill="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Rate (%)</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dummyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} hide />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }} />
                  <Area type="step" dataKey="errors" stroke="#ef4444" fillOpacity={0.1} fill="#ef4444" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
