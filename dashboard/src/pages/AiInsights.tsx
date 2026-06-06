import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, BrainCircuit } from 'lucide-react';

export default function AiInsights() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const res = await axios.get(`${API_URL}/api/insights`);
        setInsights(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
    const interval = setInterval(fetchInsights, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = {
    total: insights.length,
    critical: insights.filter(i => i.severity === 'CRITICAL').length,
    high: insights.filter(i => i.severity === 'HIGH').length,
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <h2 className="text-3xl font-bold tracking-tight">AI Root Cause Insights</h2>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-muted/20 border-border/50">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Analysed</p>
              <h3 className="text-3xl font-bold mt-1">{stats.total}</h3>
            </div>
            <Info className="w-8 h-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Critical Incidents</p>
              <h3 className="text-3xl font-bold text-destructive mt-1">{stats.critical}</h3>
            </div>
            <AlertCircle className="w-8 h-8 text-destructive/40" />
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">High Severity</p>
              <h3 className="text-3xl font-bold text-orange-500 mt-1">{stats.high}</h3>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500/40" />
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4 mb-6">
        <select className="bg-card border border-border text-sm rounded-md px-3 py-2 text-foreground outline-none">
          <option>All Severities</option>
          <option>CRITICAL</option>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
        <select className="bg-card border border-border text-sm rounded-md px-3 py-2 text-foreground outline-none">
          <option>All Services</option>
          <option>payment-service</option>
          <option>order-service</option>
          <option>inventory-service</option>
        </select>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading AI analysis...</div>
        ) : insights.length === 0 ? (
          <Card className="bg-muted/10 border-dashed">
             <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No active incidents</h3>
                <p className="text-muted-foreground max-w-sm">The LLM has not detected any anomalous traces in the last period. Your system is running smoothly.</p>
             </CardContent>
          </Card>
        ) : (
          insights.map((insight) => (
            <Card key={insight.traceId} className="overflow-hidden border-border transition-all hover:border-primary/30">
              <div className={`h-1 w-full ${insight.severity === 'CRITICAL' ? 'bg-destructive' : 'bg-orange-500'}`} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3 items-center">
                    <Badge variant={getSeverityColor(insight.severity) as any} className={insight.severity === 'HIGH' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}>
                      {insight.severity}
                    </Badge>
                    <span className="font-semibold text-lg">{insight.serviceName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{new Date(insight.timestamp).toLocaleString()}</span>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Root Cause</h4>
                    <p className="text-sm leading-relaxed">{insight.rootCause}</p>
                  </div>
                  <div className="space-y-2 bg-muted/30 p-4 rounded-lg border border-border">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4" /> Recommended Action
                    </h4>
                    <p className="text-sm leading-relaxed text-primary/90">{insight.recommendation}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <span>Trace ID: <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">{insight.traceId}</span></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
