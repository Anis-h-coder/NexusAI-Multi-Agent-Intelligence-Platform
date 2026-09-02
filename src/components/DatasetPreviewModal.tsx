import React, { useState } from 'react';
import { UploadedDatasetInfo } from '../utils/datasetParser';
import { X, Table, BarChart2, CheckCircle2, FileSpreadsheet, Sparkles, HelpCircle } from 'lucide-react';

interface DatasetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: UploadedDatasetInfo;
  onSelectPrompt: (promptText: string) => void;
}

export const DatasetPreviewModal: React.FC<DatasetPreviewModalProps> = ({
  isOpen,
  onClose,
  dataset,
  onSelectPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'preview' | 'questions'>('stats');

  if (!isOpen) return null;

  const targetCandidate = dataset.columns.find(
    (c) => c.toLowerCase().includes('target') || c.toLowerCase().includes('churn') || c.toLowerCase().includes('label') || c.toLowerCase().includes('status') || c.toLowerCase().includes('price')
  ) || dataset.columns[dataset.columns.length - 1] || 'Target';

  const suggestedQuestions = [
    `Analyze key correlations, distribution skew, and missing values in dataset "${dataset.fileName}".`,
    `Train an XGBoost classifier predicting target attribute "${targetCandidate}" using ${dataset.colCount} features and evaluate ROC-AUC.`,
    `Build a production FastAPI microservice to infer predictions on "${dataset.fileName}" columns (${dataset.columns.slice(0, 4).join(', ')}...).`,
    `Identify the top 5 key drivers and TreeSHAP attributions affecting "${targetCandidate}".`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">{dataset.fileName}</h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
                  {dataset.fileType} • {dataset.fileSize}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Parsed <span className="font-semibold text-slate-700">{dataset.rowCount.toLocaleString()} rows</span> and{' '}
                <span className="font-semibold text-slate-700">{dataset.colCount} feature columns</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Column Profiling & Stats ({dataset.stats.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Data Grid Sample ({Math.min(dataset.sampleRows.length, 10)} Rows)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'questions'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Suggested Questions & Objectives</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>
                  Feature Types:{' '}
                  <strong className="text-slate-900">
                    {Object.values(dataset.columnTypes).filter((t) => t === 'numeric').length} Numeric
                  </strong>
                  ,{' '}
                  <strong className="text-slate-900">
                    {Object.values(dataset.columnTypes).filter((t) => t === 'categorical').length} Categorical
                  </strong>
                  ,{' '}
                  <strong className="text-slate-900">
                    {Object.values(dataset.columnTypes).filter((t) => t === 'boolean').length} Boolean
                  </strong>
                </span>
                <span className="text-emerald-700 font-medium">✓ Client-Side Profiling Complete</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs bg-white scrollbar-thin">
                <table className="w-full min-w-max text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 backdrop-blur-xs">
                      <th className="py-2.5 px-3.5 border-r border-slate-200">Column Name</th>
                      <th className="py-2.5 px-3.5 border-r border-slate-200">Data Type</th>
                      <th className="py-2.5 px-3.5 border-r border-slate-200">Null Count</th>
                      <th className="py-2.5 px-3.5">Min / Max / Average or Top Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {dataset.stats.map((stat, idx) => (
                      <tr key={idx} className="even:bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 border-r border-slate-100">{stat.name}</td>
                        <td className="py-2.5 px-3.5 border-r border-slate-100">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              stat.type === 'numeric'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : stat.type === 'boolean'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {stat.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-100">
                          {stat.nullCount > 0 ? (
                            <span className="text-amber-600 font-bold">{stat.nullCount} nulls</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">0 nulls (100% clean)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700">
                          {stat.type === 'numeric' ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                Min: <strong className="text-slate-900">{stat.min}</strong>
                              </span>
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                Max: <strong className="text-slate-900">{stat.max}</strong>
                              </span>
                              <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                                Avg: {stat.mean}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                                Top: &quot;{stat.topValue || 'N/A'}&quot;
                              </span>
                              <span className="text-slate-500 font-sans text-xs">
                                ({stat.topCount || 0} rows)
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Displaying sample records extracted from <strong className="text-slate-800">{dataset.fileName}</strong>:
              </p>
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-[50vh] bg-white scrollbar-thin">
                <table className="w-full min-w-max text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-20 backdrop-blur-xs">
                      <th className="py-2.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-30 text-center w-10">#</th>
                      {dataset.columns.map((col, idx) => (
                        <th key={idx} className="py-2.5 px-3.5 border-r border-slate-200 min-w-[130px] font-mono text-slate-800 text-xs">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {dataset.sampleRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="even:bg-slate-50/60 hover:bg-emerald-50/30 transition-colors">
                        <td className="py-2 px-3 bg-slate-50 font-bold text-slate-500 border-r border-slate-200 sticky left-0 z-10 text-center">
                          {rowIdx + 1}
                        </td>
                        {dataset.columns.map((col, colIdx) => (
                          <td key={colIdx} className="py-2 px-3.5 border-r border-slate-100 text-slate-800 tabular-nums">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Click any suggested dataset question below to auto-fill the Planner Agent prompt and execute the fleet.
                </span>
              </div>

              <div className="space-y-2.5">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectPrompt(q);
                      onClose();
                    }}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/40 text-xs text-slate-800 hover:text-slate-900 font-medium transition-all group cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        Q{idx + 1}
                      </span>
                      <span>{q}</span>
                    </div>
                    <span className="text-emerald-600 opacity-0 group-hover:opacity-100 text-xs font-bold transition-opacity shrink-0 flex items-center gap-1">
                      <span>Select</span> →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Ready for Multi-Agent Execution</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
