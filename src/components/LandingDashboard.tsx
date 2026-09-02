import React, { useState } from 'react';
import {
  Brain,
  Zap,
  CheckCircle2,
  Clock,
  TrendingUp,
  Cpu,
  Layers,
  Database,
  BarChart3,
  Bot,
  Play,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import { AgentState } from '../types';

interface LandingDashboardProps {
  agents: AgentState[];
  setActiveTab: (tab: string) => void;
  onRunQuickTask: (promptText: string) => void;
}

const TOKEN_USAGE_DATA = [
  { agent: 'Planner', role: 'Planner Agent', tokens: 45200, ms: 180, color: '#10B981' }, // Emerald Green
  { agent: 'Research', role: 'Research Agent', tokens: 89100, ms: 420, color: '#F59E0B' }, // Amber / Gold
  { agent: 'Analyst', role: 'Data Analyst', tokens: 62400, ms: 310, color: '#06B6D4' }, // Cyan
  { agent: 'ML Eng', role: 'ML Engineer', tokens: 112000, ms: 890, color: '#8B5CF6' }, // Purple
  { agent: 'Software', role: 'Software Agent', tokens: 94800, ms: 650, color: '#EC4899' }, // Pink
  { agent: 'Docs', role: 'Documentation', tokens: 31200, ms: 240, color: '#3B82F6' }, // Blue
];

const TOTAL_TOKENS = TOKEN_USAGE_DATA.reduce((acc, curr) => acc + curr.tokens, 0);
const AVG_LATENCY = Math.round(
  TOKEN_USAGE_DATA.reduce((acc, curr) => acc + curr.ms, 0) / TOKEN_USAGE_DATA.length
);
const PEAK_WORKER = [...TOKEN_USAGE_DATA].sort((a, b) => b.tokens - a.tokens)[0];

export const LandingDashboard: React.FC<LandingDashboardProps> = ({
  agents,
  setActiveTab,
  onRunQuickTask,
}) => {
  const [quickPrompt, setQuickPrompt] = useState('');
  const [chartView, setChartView] = useState<'bar' | 'pie' | 'latency'>('bar');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    onRunQuickTask(quickPrompt);
    setActiveTab('agents');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Platform Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <Brain className="w-3.5 h-3.5" />
            <span>Autonomous Multi-Agent Intelligence Architecture</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Enterprise AI Operating System & Autonomous Agent Hub
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl">
            NexusAI orchestrates 6 specialized AI agents collaborating in real time to solve complex data science, machine learning, RAG semantic search, software engineering, and business intelligence tasks.
          </p>

          {/* Quick Task Launcher Bar */}
          <form onSubmit={handleQuickSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder="e.g. Analyze customer churn dataset, fit XGBoost model with SHAP, and generate REST API endpoint..."
                className="w-full bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Orchestrate Agents</span>
            </button>
          </form>
        </div>
      </div>

      {/* Autonomous Goal Engine Featured Action Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
            <Brain className="w-3.5 h-3.5" />
            <span>🧠 Autonomous Goal Engine</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white">
            "Analyze our sales data and identify why revenue dropped."
          </h2>
          <p className="text-slate-300 text-xs leading-relaxed">
            NexusAI automatically executes the complete multi-agent DAG:
            <span className="text-emerald-400 font-semibold"> Planner → Research Agent → Data Analyst → ML Agent → Software Agent → Documentation Agent</span>.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('goalEngine')}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
        >
          <span>Launch Goal Engine</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Autonomous Agents
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">6 Workers</span>
            <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              <span>All Active</span>
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">Autonomous Multi-Agent DAG Ready</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              RAG Vector Retrieval
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">14.2 ms</span>
            <span className="text-[11px] text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded-full shrink-0">
              ChromaDB Index
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">270 Vector Chunks Indexed</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              AutoML Best Model
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">91.2% Acc</span>
            <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
              XGBoost
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">SHAP Explainability Computed</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Daily LLM Processing
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">434,700</span>
            <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
              Tokens
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">Gemini Server-side</p>
        </div>
      </div>

      {/* Main Content Grid: Active Agents Grid + Analytics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Agents Grid (2 cols on LG) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Active Multi-Agent Worker Swarm</h2>
              <p className="text-xs text-slate-500">
                Autonomous specialized agents linked via LangGraph state graph
              </p>
            </div>
            <button
              onClick={() => setActiveTab('agents')}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              <span>View Interactive DAG</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div
                key={agent.role}
                className="bg-white border border-slate-200/80 rounded-xl p-4 hover:border-emerald-500/40 transition-all duration-200 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{agent.avatar}</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {agent.role.endsWith('Agent') ? agent.role : `${agent.role} Agent`}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400">{agent.name}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>READY</span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Tokens: <strong>{agent.tokenUsage.toLocaleString()}</strong></span>
                  <span>Latency: <strong>Fast</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Usage & Latency Benchmarks Chart */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Agent Token Consumption</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    {(TOTAL_TOKENS / 1000).toFixed(1)}K Tokens
                  </span>
                </h2>
                <p className="text-xs text-slate-500">Real-time LLM telemetry across 6 specialist agents</p>
              </div>

              {/* View Selector Buttons */}
              <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200/80 text-[11px] font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setChartView('bar')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                    chartView === 'bar'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Tokens</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('pie')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                    chartView === 'pie'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PieChartIcon className="w-3 h-3" />
                  <span>Share %</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('latency')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                    chartView === 'latency'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  <span>Latency</span>
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'bar' ? (
                  <BarChart data={TOKEN_USAGE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="agent"
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={35}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const pct = ((data.tokens / TOTAL_TOKENS) * 100).toFixed(1);
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-white text-xs space-y-1">
                              <p className="font-bold flex items-center justify-between gap-3" style={{ color: data.color }}>
                                <span>{data.role}</span>
                                <span className="text-[10px] font-mono text-slate-300">({pct}%)</span>
                              </p>
                              <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                                <span>Tokens Used:</span>
                                <span className="font-mono font-bold text-white">{data.tokens.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                                <span>Execution Latency:</span>
                                <span className="font-mono font-bold text-emerald-300">{data.ms} ms</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="tokens" radius={[6, 6, 0, 0]}>
                      {TOKEN_USAGE_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartView === 'pie' ? (
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Pie
                      data={TOKEN_USAGE_DATA}
                      dataKey="tokens"
                      nameKey="agent"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {TOKEN_USAGE_DATA.map((entry, index) => (
                        <Cell key={`cell-pie-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const pct = ((data.tokens / TOTAL_TOKENS) * 100).toFixed(1);
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-white text-xs space-y-1">
                              <p className="font-bold flex items-center justify-between gap-2" style={{ color: data.color }}>
                                <span>{data.role}</span>
                                <span className="text-[10px] font-mono text-slate-300">({pct}%)</span>
                              </p>
                              <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                                <span>Token Count:</span>
                                <span className="font-mono font-bold text-white">{data.tokens.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                                <span>Execution Speed:</span>
                                <span className="font-mono font-bold text-teal-300">{data.ms} ms</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                ) : (
                  <AreaChart data={TOKEN_USAGE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <defs>
                      <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="agent"
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={35}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit=" ms" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-white text-xs space-y-1">
                              <p className="font-bold flex items-center justify-between gap-2" style={{ color: data.color }}>
                                <span>{data.role}</span>
                                <span className="text-[10px] font-mono text-emerald-300">{data.ms} ms</span>
                              </p>
                              <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                                <span>Tokens Allocated:</span>
                                <span className="font-mono font-bold text-white">{data.tokens.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="ms" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#latencyGrad)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Total Usage</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 font-mono whitespace-nowrap">
                {(TOTAL_TOKENS / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Peak Worker</span>
              <p className="text-xs sm:text-sm font-bold text-purple-600 mt-0.5 font-mono whitespace-nowrap">
                ML (112K)
              </p>
            </div>
            <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Avg Latency</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 font-mono whitespace-nowrap">
                {AVG_LATENCY} ms
              </p>
            </div>
            <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">DAG Fleet</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 font-mono whitespace-nowrap">
                6 Active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Feature Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        <button
          onClick={() => setActiveTab('automl')}
          className="text-left bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 p-5 rounded-2xl hover:border-emerald-400 transition-all duration-200 group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold mb-3 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">AutoML & Model Workbench</h3>
          <p className="text-xs text-slate-600 mt-1">
            XGBoost, LightGBM, Prophet forecasting & SHAP explainability.
          </p>
        </button>

        <button
          onClick={() => setActiveTab('rag')}
          className="text-left bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200/80 p-5 rounded-2xl hover:border-teal-400 transition-all duration-200 group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-bold mb-3 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">RAG Knowledge Engine</h3>
          <p className="text-xs text-slate-600 mt-1">
            Upload PDFs, CSVs, Excel, & query ChromaDB vector index.
          </p>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className="text-left bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200/80 p-5 rounded-2xl hover:border-cyan-400 transition-all duration-200 group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500 text-slate-950 flex items-center justify-center font-bold mb-3 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Natural Language SQL</h3>
          <p className="text-xs text-slate-600 mt-1">
            Ask questions in plain English & autogenerate Recharts graphics.
          </p>
        </button>
      </div>
    </div>
  );
};
