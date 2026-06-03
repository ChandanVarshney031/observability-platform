import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  dagre
} from 'reactflow';
import 'reactflow/dist/style.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function ServiceGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/services`);
      
      // Convert to react-flow format
      const flowNodes = res.data.nodes.map((node, idx) => ({
        id: node.id,
        data: { label: node.label },
        position: { x: idx * 250, y: 0 },
      }));

      const flowEdges = res.data.edges.map((edge, idx) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: `${edge.callCount} calls`,
        animated: true,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);

      return res.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading service graph...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold text-white">Service Dependency Graph</h2>
      <div className="bg-slate-800 rounded-lg h-96">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        >
          <Background color="#334155" />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
