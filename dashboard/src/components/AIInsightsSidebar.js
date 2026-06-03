import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Zap, AlertTriangle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function AIInsightsSidebar() {
  const navigate = useNavigate();

  // We assume there's an endpoint /api/insights that returns the 10 most recent insights
  const { data, isLoading } = useQuery({
    queryKey: ['recent-insights'],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_URL}/api/insights`);
        return res.data;
      } catch (e) {
        return { insights: [] };
      }
    },
    refetchInterval: 15000,
  });

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 h-[calc(100vh-73px)] overflow-y-auto sticky top-[73px]">
      <div className="p-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          AI Insights
        </h3>
        <p className="text-xs text-slate-400 mt-1">Recent root cause analyses</p>
      </div>
      
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="text-center text-slate-400 py-4">Loading insights...</div>
        ) : data?.insights && data.insights.length > 0 ? (
          data.insights.map((insight, idx) => (
            <div 
              key={idx} 
              className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 border border-slate-600 transition cursor-pointer"
              onClick={() => navigate(`/traces?traceId=${insight.TraceId}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-white truncate pr-2">
                  {insight.ServiceName}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                  insight.Severity === 'critical' || insight.Severity === 'high' 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {insight.Severity}
                </span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-3 mb-2" title={insight.RootCause}>
                {insight.RootCause}
              </p>
              <div className="text-[10px] text-slate-500 flex justify-between items-center mt-2 pt-2 border-t border-slate-600/50">
                <span>{insight.TraceId.substring(0, 8)}...</span>
                <span>{new Date(insight.AnalysedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-slate-400 py-4 text-sm bg-slate-900/20 rounded border border-slate-700/50">
            No recent AI insights.
          </div>
        )}
      </div>
    </div>
  );
}
