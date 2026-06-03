import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 172;
  const nodeHeight = 36;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'LR' ? 'left' : 'top';
    node.sourcePosition = direction === 'LR' ? 'right' : 'bottom';
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

export default function ServiceGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { isLoading, data } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/services`);
      return res.data;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (data && data.nodes && data.edges) {
      const nodeCallVolumes = {};
      data.edges.forEach(edge => {
        nodeCallVolumes[edge.source] = (nodeCallVolumes[edge.source] || 0) + Number(edge.callCount);
        nodeCallVolumes[edge.target] = (nodeCallVolumes[edge.target] || 0) + Number(edge.callCount);
      });

      const maxVolume = Math.max(...Object.values(nodeCallVolumes), 1) || 1;

      const flowNodes = data.nodes.map((node) => {
        const volume = nodeCallVolumes[node.id] || 0;
        const scale = 1 + (volume / maxVolume) * 0.3; // scale up to 1.3x
        return {
          id: node.id,
          data: { label: node.label },
          position: { x: 0, y: 0 },
          style: {
            transform: `scale(${scale})`,
            transition: 'transform 0.3s ease',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '10px'
          }
        };
      });

      const maxCallCount = Math.max(...data.edges.map(e => Number(e.callCount)), 1) || 1;

      const flowEdges = data.edges.map((edge) => {
        const latencyMs = edge.avg_latency_ns / 1_000_000;
        let color = '#10b981'; // green
        if (latencyMs > 500) {
          color = '#ef4444'; // red
        } else if (latencyMs > 200) {
          color = '#f59e0b'; // amber
        }

        const strokeWidth = 1 + (Number(edge.callCount) / maxCallCount) * 4;

        return {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: `${edge.callCount} calls (${latencyMs.toFixed(0)}ms)`,
          animated: true,
          style: { stroke: color, strokeWidth },
          labelStyle: { fill: '#cbd5e1', fontWeight: 500, fontSize: 12 },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
          labelBgPadding: [4, 4],
          labelBgBorderRadius: 4
        };
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges, 'LR');

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [data, setNodes, setEdges]);

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading service graph...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold text-white">Service Dependency Graph</h2>
      <div className="bg-slate-800 rounded-lg h-96 border border-slate-700">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#334155" />
          <Controls className="bg-slate-700 text-white fill-white" />
          <MiniMap 
            nodeColor="#334155"
            maskColor="rgba(15, 23, 42, 0.7)"
            style={{ backgroundColor: '#1e293b' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
