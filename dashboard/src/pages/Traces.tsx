import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Traces() {
  const [traces, setTraces] = useState<any[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTraces = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const res = await axios.get(`${API_URL}/api/traces?limit=50`);
        setTraces(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTraces();
    const interval = setInterval(fetchTraces, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 flex flex-col transition-all ${selectedTrace ? 'w-2/3' : 'w-full'}`}>
        <h2 className="text-3xl font-bold tracking-tight mb-6">Traces Explorer</h2>
        
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex gap-4 bg-muted/20">
            {/* Filter Bar Placeholder */}
            <select className="bg-background border border-border text-sm rounded-md px-3 py-1.5 text-foreground">
              <option>All Services</option>
              <option>api-gateway</option>
              <option>order-service</option>
              <option>payment-service</option>
            </select>
            <select className="bg-background border border-border text-sm rounded-md px-3 py-1.5 text-foreground">
              <option>All Status</option>
              <option>Error</option>
              <option>OK</option>
            </select>
          </div>
          
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Trace ID</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading traces...</TableCell></TableRow>
                ) : traces.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">No traces found</TableCell></TableRow>
                ) : (
                  traces.map((trace) => (
                    <TableRow 
                      key={trace.traceId} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTrace(trace)}
                    >
                      <TableCell className="font-mono text-xs">{trace.traceId.substring(0, 8)}</TableCell>
                      <TableCell className="font-medium">{trace.serviceName}</TableCell>
                      <TableCell>{trace.operationName}</TableCell>
                      <TableCell>{trace.durationMs ? `${Math.round(trace.durationMs)}ms` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={trace.statusCode === 'ERROR' ? 'destructive' : 'default'} className={trace.statusCode === 'ERROR' ? '' : 'bg-success hover:bg-success'}>
                          {trace.statusCode || 'OK'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(trace.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {selectedTrace && (
        <Card className="w-1/3 flex flex-col animate-in slide-in-from-right-8 duration-300">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
            <h3 className="font-semibold truncate">Trace Details</h3>
            <button 
              className="text-muted-foreground hover:text-foreground px-2 py-1"
              onClick={() => setSelectedTrace(null)}
            >
              ✕
            </button>
          </div>
          <CardContent className="flex-1 overflow-auto p-4 space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Trace ID</div>
              <div className="font-mono text-sm bg-muted p-2 rounded">{selectedTrace.traceId}</div>
            </div>
            
            {/* Waterfall Placeholder */}
            <div>
              <h4 className="font-semibold mb-3">Span Waterfall</h4>
              <div className="space-y-2 border-l-2 border-border pl-4">
                <div className="relative h-6 bg-primary/20 rounded w-full flex items-center px-2 text-xs text-primary font-medium">
                  {selectedTrace.serviceName} : {selectedTrace.operationName}
                </div>
                <div className="relative h-6 bg-blue-500/20 rounded w-[80%] ml-[10%] flex items-center px-2 text-xs text-blue-400 font-medium">
                  child_span_placeholder
                </div>
              </div>
            </div>

            {selectedTrace.statusCode === 'ERROR' && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                <h4 className="text-destructive font-semibold mb-2">Error Details</h4>
                <p className="text-sm text-destructive/80 font-mono">
                  Exception: Database connection timeout.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
