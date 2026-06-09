import { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent } from '@/components/ui/card';
import { fetchServices, fetchMetrics } from '@/lib/api';

const NODE_STYLE = {
  background: '#1e293b',
  color: '#f8fafc',
  border: '2px solid #475569',
  borderRadius: '8px',
  padding: '10px',
  fontSize: '12px',
  textAlign: 'center' as const,
};

function buildGraph(
  nodes: { id: string; label: string }[],
  edges: { source: string; target: string; callCount: number; avgLatencyMs: number; errorCount: number }[]
): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = nodes.map((n, i) => ({
    id: n.id,
    position: { x: 100 + (i % 3) * 200, y: 50 + Math.floor(i / 3) * 120 },
    data: { label: n.label },
    style: NODE_STYLE,
  }));

  const flowEdges: Edge[] = edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    animated: true,
    label: `${Math.round(e.avgLatencyMs)}ms`,
    style: e.avgLatencyMs > 500 ? { stroke: '#ef4444' } : undefined,
  }));

  return { nodes: flowNodes, edges: flowEdges };
}

export default function Services() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeMetrics, setNodeMetrics] = useState({ requests: 0, errorRate: 0, p99: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { nodes: apiNodes, edges: apiEdges } = await fetchServices();
        const graph = buildGraph(apiNodes, apiEdges);
        setNodes(graph.nodes);
        setEdges(graph.edges);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    try {
      const metrics = await fetchMetrics(node.id, '1h');
      const total = metrics.reduce((acc, m) => acc + m.rps * 60, 0);
      const latest = metrics[metrics.length - 1];
      setNodeMetrics({
        requests: Math.round(total),
        errorRate: latest?.errors ?? 0,
        p99: latest?.p99 ?? 0,
      });
    } catch {
      setNodeMetrics({ requests: 0, errorRate: 0, p99: 0 });
    }
  }, []);

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col h-[calc(100vh-6rem)]">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Service Dependency Graph</h2>
        <Card className="flex-1 overflow-hidden">
          {loading && nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Loading service map...</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              className="bg-[#0F1117]"
            >
              <Background color="#2A2D3E" gap={16} />
              <Controls className="bg-card border-border fill-foreground text-foreground" />
            </ReactFlow>
          )}
        </Card>
      </div>

      {selectedNode && (
        <Card className="w-80 flex flex-col animate-in slide-in-from-right-8 duration-300">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
            <h3 className="font-semibold truncate">Service Metrics</h3>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedNode(null)}>✕</button>
          </div>
          <CardContent className="p-4 space-y-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl mx-auto flex items-center justify-center mb-2 border border-primary/30">
                <span className="text-2xl">⚡</span>
              </div>
              <h4 className="font-bold text-lg">{selectedNode.id}</h4>
              <span className="text-sm text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Healthy</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">Requests (1h)</span>
                <span className="font-medium text-foreground">{nodeMetrics.requests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">Error Rate</span>
                <span className="font-medium text-foreground">{nodeMetrics.errorRate.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">P99 Latency</span>
                <span className="font-medium text-foreground">{nodeMetrics.p99.toFixed(0)}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
