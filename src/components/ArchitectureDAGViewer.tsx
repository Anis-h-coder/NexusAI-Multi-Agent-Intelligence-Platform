import React, { useState } from 'react';
import {
  Brain,
  Search,
  BarChart3,
  Cpu,
  Terminal,
  FileCheck2,
  ArrowRight,
  Database,
  Server,
  ShieldCheck,
  CheckCircle,
  Activity,
  Layers,
} from 'lucide-react';

interface ArchitectureDAGViewerProps {
  taskPrompt: string;
}

export const ArchitectureDAGViewer: React.FC<ArchitectureDAGViewerProps> = ({ taskPrompt }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ml');

  const nodes = [
    {
      id: 'planner',
      order: '01',
      name: 'Planner Agent',
      role: 'Planner',
      icon: Brain,
      color: 'emerald',
      model: 'Gemini Engine',
      sla: '320ms',
      status: 'Ready / Synced',
      inputs: ['User Natural Language Objective', 'System Resource Constraints'],
      outputs: ['Topological DAG Execution Plan', 'Specialist Agent Route Map'],
      description: 'Performs semantic intent decomposition and constructs optimal DAG dependencies with zero-overhead routing.',
    },
    {
      id: 'research',
      order: '02',
      name: 'Research Lead',
      role: 'Research Agent',
      icon: Search,
      color: 'blue',
      model: 'Gemini Engine',
      sla: '430ms',
      status: 'Ready / Synced',
      inputs: ['Domain Keywords', 'Benchmark Standards'],
      outputs: ['SOTA Architecture Literature', 'Algorithm Candidates & Baseline Comparisons'],
      description: 'Grounds solution in state-of-the-art literature and retrieves baseline architecture metrics.',
    },
    {
      id: 'analyst',
      order: '03',
      name: 'Data Analyst',
      role: 'Data Analyst Agent',
      icon: BarChart3,
      color: 'indigo',
      model: 'Gemini Engine',
      sla: '540ms',
      status: 'Ready / Synced',
      inputs: ['Raw Tabular Dataset', 'Feature Dictionaries'],
      outputs: ['Statistical EDA Audit', 'Zero-Leakage Imputation & Scaling Pipeline'],
      description: 'Profiles distributions, verifies missingness mechanisms, and eliminates multicollinearity (VIF < 5.0).',
    },
    {
      id: 'ml',
      order: '04',
      name: 'ML Agent',
      role: 'ML Agent',
      icon: Cpu,
      color: 'purple',
      model: 'Gemini Engine',
      sla: '920ms',
      status: 'Ready / Synced',
      inputs: ['Cleaned Train/Val Splits', 'Candidate Hyperparameter Grids'],
      outputs: ['Trained Model Weights', '5-Fold CV Metrics & TreeSHAP Drivers'],
      description: 'Trains ensemble classifiers/regressors, runs 5-fold cross-validation, and computes TreeSHAP explainability.',
    },
    {
      id: 'software',
      order: '05',
      name: 'Software Agent',
      role: 'Software Agent',
      icon: Terminal,
      color: 'pink',
      model: 'Gemini Engine',
      sla: '710ms',
      status: 'Ready / Synced',
      inputs: ['Champion Model Artifact', 'Pydantic v2 Contract Specs'],
      outputs: ['Production FastAPI Microservice', 'pytest Matrix & Dockerfile'],
      description: 'Implements production-grade REST microservice endpoints, strict request/response validation, and unit tests.',
    },
    {
      id: 'documentation',
      order: '06',
      name: 'Doc Synthesizer',
      role: 'Documentation Agent',
      icon: FileCheck2,
      color: 'amber',
      model: 'Gemini Engine',
      sla: '470ms',
      status: 'Ready / Synced',
      inputs: ['All Specialist Stage Outputs', 'Performance Benchmarks'],
      outputs: ['Master Technical Architecture Runbook', 'Deployment Verification Script'],
      description: 'Synthesizes enterprise solution specification, SLA guarantees, data dictionary, and verification guides.',
    },
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[3];
  const SelectedIcon = selectedNode.icon;

  return (
    <div className="space-y-4 text-slate-800">
      {/* Architecture Header Banner */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Interactive Multi-Agent System Architecture & Dataflow DAG</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              End-to-end topological pipeline mapping data contracts, latency bounds & zero-leakage isolation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            Total Pipeline Latency: 3,390ms
          </span>
        </div>
      </div>

      {/* Interactive Visual DAG Pipeline */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
          <span className="font-bold text-slate-900 font-mono uppercase text-[11px]">
            Topological Agent Execution Sequence
          </span>
          <span className="text-slate-500 text-[11px]">
            Click any node below to inspect architectural contracts & data boundaries
          </span>
        </div>

        {/* Desktop Pipeline Flow */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {nodes.map((node, i) => {
            const isSelected = selectedNodeId === node.id;
            const Icon = node.icon;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`
                  relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[110px]
                  ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/30'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                    Node {node.order}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isSelected ? 'bg-slate-800 text-emerald-400' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    {node.sla}
                  </span>
                </div>

                <div className="my-2 flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-slate-800 text-emerald-400' : 'bg-white text-slate-700 shadow-2xs'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {node.name}
                    </p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                      {node.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-200/50">
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Verified
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Node Detail Inspector */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs">
              <SelectedIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Node {selectedNode.order}: {selectedNode.name} ({selectedNode.role})
                </h4>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedNode.model}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{selectedNode.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              Status: {selectedNode.status}
            </span>
          </div>
        </div>

        {/* Input / Output Contracts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Upstream Input Contracts & Ingestion</span>
            </div>
            <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
              {selectedNode.inputs.map((inp, idx) => (
                <li key={idx} className="font-mono text-[11px]">{inp}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Server className="w-3.5 h-3.5 text-emerald-600" />
              <span>Downstream Output Deliverables & Artifacts</span>
            </div>
            <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
              {selectedNode.outputs.map((out, idx) => (
                <li key={idx} className="font-mono text-[11px]">{out}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Production Microservice Runtime Topology */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          End-to-End Enterprise Deployment Architecture
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs text-center">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900">1. Client Request</p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">REST JSON Payload</p>
            <span className="text-[10px] text-slate-400">HTTPS / TLS 1.3</span>
          </div>

          <div className="p-3 rounded-lg bg-pink-50 border border-pink-200">
            <p className="font-bold text-pink-950">2. FastAPI Gateway</p>
            <p className="text-[11px] text-pink-700 mt-1 font-mono">Pydantic v2 Schema</p>
            <span className="text-[10px] text-pink-600">Sub-2ms Validation</span>
          </div>

          <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
            <p className="font-bold text-purple-950">3. XGBoost Model</p>
            <p className="text-[11px] text-purple-700 mt-1 font-mono">Calibrated Inference</p>
            <span className="text-[10px] text-purple-600">Sub-12ms p95 SLA</span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-950">4. Response & SHAP</p>
            <p className="text-[11px] text-emerald-700 mt-1 font-mono">Prediction + Attributions</p>
            <span className="text-[10px] text-emerald-600">Prometheus Telemetry</span>
          </div>
        </div>
      </div>
    </div>
  );
};
