import { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';

const initialNodes: Node[] = [
  { id: 'api-gateway', position: { x: 250, y: 50 }, data: { label: 'api-gateway\n(120 req/m)' }, style: { background: '#1e293b', color: '#f8fafc', border: '2px solid #475569', borderRadius: '8px', padding: '10px' } },
  { id: 'order-service', position: { x: 100, y: 150 }, data: { label: 'order-service\n(40 req/m)' }, style: { background: '#1e293b', color: '#f8fafc', border: '2px solid #475569', borderRadius: '8px', padding: '10px' } },
  { id: 'inventory-service', position: { x: 100, y: 250 }, data: { label: 'inventory-service\n(40 req/m)' }, style: { background: '#1e293b', color: '#f8fafc', border: '2px solid #475569', borderRadius: '8px', padding: '10px' } },
  { id: 'payment-service', position: { x: 400, y: 150 }, data: { label: 'payment-service\n(40 req/m)' }, style: { background: '#1e293b', color: '#f8fafc', border: '2px solid #ef4444', borderRadius: '8px', padding: '10px' } },
  { id: 'notification-service', position: { x: 400, y: 250 }, data: { label: 'notification-service\n(40 req/m)' }, style: { background: '#1e293b', color: '#f8fafc', border: '2px solid #475569', borderRadius: '8px', padding: '10px' } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'api-gateway', target: 'order-service', animated: true, label: '50ms' },
  { id: 'e2-3', source: 'order-service', target: 'inventory-service', animated: true, label: '20ms' },
  { id: 'e1-4', source: 'api-gateway', target: 'payment-service', animated: true, label: '300ms', style: { stroke: '#ef4444' } },
  { id: 'e1-5', source: 'api-gateway', target: 'notification-service', animated: true, label: '10ms' },
];

export default function Services() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col h-[calc(100vh-6rem)]">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Service Dependency Graph</h2>
        <Card className="flex-1 overflow-hidden">
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
                <span className="font-medium text-foreground">1,245</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">Error Rate</span>
                <span className="font-medium text-foreground">0.2%</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">P99 Latency</span>
                <span className="font-medium text-foreground">45ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
