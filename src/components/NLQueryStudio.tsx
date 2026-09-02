import React, { useState, useRef } from 'react';
import {
  Terminal,
  Play,
  Database,
  Table as TableIcon,
  Sparkles,
  BarChart2,
  CheckCircle2,
  Clock,
  Layers,
  Code,
  HelpCircle,
  Upload,
  FileSpreadsheet,
  FileCode,
  X,
  Plus,
  Eye,
  Loader2,
  Check,
  Download,
  Copy,
  Search,
  Zap,
  Filter,
  Key,
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
} from 'recharts';
import { DatabaseTable, SqlQueryResult } from '../types';
import { SAMPLE_DATABASE_TABLES } from '../data/mockData';
import { safeFetchJson } from '../utils/apiClient';

export const NLQueryStudio: React.FC = () => {
  const [tables, setTables] = useState<DatabaseTable[]>(SAMPLE_DATABASE_TABLES);
  const [selectedTable, setSelectedTable] = useState<DatabaseTable>(tables[0]);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [nlPrompt, setNlPrompt] = useState('Show top 5 customers sorted by total spending history ($)');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Results view tab: 'table' | 'chart' | 'explain'
  const [activeResultTab, setActiveResultTab] = useState<'table' | 'chart' | 'explain'>('table');
  const [tableFilter, setTableFilter] = useState('');
  
  // Copy & Export state
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedData, setCopiedData] = useState(false);

  // Dataset Upload Modal & State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showRawDataPreview, setShowRawDataPreview] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [queryResult, setQueryResult] = useState<SqlQueryResult>({
    naturalPrompt: 'Show top 5 customers sorted by total spending history ($)',
    generatedSql: `SELECT customer_id, full_name, country, membership_tier, total_spend_usd
FROM customers
ORDER BY total_spend_usd DESC
LIMIT 5;`,
    explainPlan: 'Index Scan using idx_customers_total_spend on customers (cost=0.15..8.27 rows=5 width=128)',
    executionTimeMs: 12.4,
    columns: ['customer_id', 'full_name', 'country', 'membership_tier', 'total_spend_usd'],
    rows: [
      { customer_id: 'cust-104', full_name: 'Noah Garcia', country: 'Australia', membership_tier: 'VIP', total_spend_usd: 6400.25 },
      { customer_id: 'cust-101', full_name: 'Emma Watson', country: 'United States', membership_tier: 'VIP', total_spend_usd: 4850.00 },
      { customer_id: 'cust-105', full_name: 'Olivia Martinez', country: 'Germany', membership_tier: 'Gold', total_spend_usd: 3120.00 },
      { customer_id: 'cust-102', full_name: 'Liam Smith', country: 'Canada', membership_tier: 'Gold', total_spend_usd: 2190.50 },
      { customer_id: 'cust-103', full_name: 'Sophia Chen', country: 'United Kingdom', membership_tier: 'Silver', total_spend_usd: 890.00 },
    ],
    chartRecommendation: 'bar',
  });

  // Editable SQL code string
  const [editableSql, setEditableSql] = useState(queryResult.generatedSql);

  const generateClientSql = (prompt: string, table: DatabaseTable): SqlQueryResult => {
    const p = prompt.toLowerCase();
    const tableName = table.tableName;
    const sampleRows = table.sampleRows || [];
    const colNames = table.columns.map((c) => c.name);

    let sql = `SELECT * FROM ${tableName} LIMIT 10;`;
    let rows = [...sampleRows];
    let chartRec: 'bar' | 'pie' | 'line' | 'table' = 'bar';

    if (p.includes('top') || p.includes('highest') || p.includes('spend') || p.includes('mrr') || p.includes('amount') || p.includes('revenue')) {
      const numCol = colNames.find((c) => c.includes('spend') || c.includes('mrr') || c.includes('revenue') || c.includes('amount') || c.includes('total')) || colNames[colNames.length - 1];
      sql = `SELECT ${colNames.slice(0, 4).join(', ')}, ${numCol}\nFROM ${tableName}\nORDER BY ${numCol} DESC\nLIMIT 5;`;
      rows = [...sampleRows].sort((a, b) => (Number(b[numCol]) || 0) - (Number(a[numCol]) || 0)).slice(0, 5);
      chartRec = 'bar';
    } else if (p.includes('gold') || p.includes('silver') || p.includes('tier') || p.includes('membership')) {
      const tierCol = colNames.find((c) => c.includes('tier') || c.includes('membership')) || colNames[0];
      sql = `SELECT ${colNames.join(', ')}\nFROM ${tableName}\nWHERE ${tierCol} IN ('Gold', 'VIP')\nORDER BY ${colNames[colNames.length - 1]} DESC;`;
      rows = sampleRows.filter((r) => String(r[tierCol] || '').toLowerCase().includes('gold') || String(r[tierCol] || '').toLowerCase().includes('vip'));
      if (rows.length === 0) rows = sampleRows.slice(0, 5);
      chartRec = 'pie';
    } else if (p.includes('country') || p.includes('germany') || p.includes('canada') || p.includes('uk')) {
      const countryCol = colNames.find((c) => c.includes('country') || c.includes('region')) || colNames[1];
      sql = `SELECT ${countryCol}, COUNT(*) AS total_customers, SUM(${colNames[colNames.length - 1]}) AS total_value\nFROM ${tableName}\nGROUP BY ${countryCol}\nORDER BY total_value DESC;`;
      chartRec = 'bar';
    } else {
      sql = `SELECT ${colNames.slice(0, 5).join(', ')}\nFROM ${tableName}\nLIMIT 10;`;
      rows = sampleRows.slice(0, 10);
      chartRec = 'table';
    }

    return {
      naturalPrompt: prompt,
      generatedSql: sql,
      columns: colNames,
      rows: rows.length > 0 ? rows : sampleRows,
      executionTimeMs: 8.4,
      chartRecommendation: chartRec,
      explainPlan: `Index Scan using idx_${tableName}_primary on ${tableName} (cost=0.15..12.30 rows=${rows.length} width=128)`,
    };
  };

  const executeClientSql = (sql: string, table: DatabaseTable) => {
    const sampleRows = table.sampleRows || [];
    const colNames = table.columns.map((c) => c.name);
    const sqlLower = sql.toLowerCase();

    let rows = [...sampleRows];

    if (sqlLower.includes('order by')) {
      const numCol = colNames.find((c) => c.includes('spend') || c.includes('mrr') || c.includes('revenue') || c.includes('amount')) || colNames[colNames.length - 1];
      if (sqlLower.includes('desc')) {
        rows.sort((a, b) => (Number(b[numCol]) || 0) - (Number(a[numCol]) || 0));
      } else {
        rows.sort((a, b) => (Number(a[numCol]) || 0) - (Number(b[numCol]) || 0));
      }
    }

    if (sqlLower.includes('where')) {
      if (sqlLower.includes('gold')) {
        rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes('gold'));
      } else if (sqlLower.includes('germany') || sqlLower.includes('canada')) {
        rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes('germany') || JSON.stringify(r).toLowerCase().includes('canada'));
      }
    }

    if (sqlLower.includes('limit 5')) {
      rows = rows.slice(0, 5);
    } else if (sqlLower.includes('limit 10')) {
      rows = rows.slice(0, 10);
    }

    if (rows.length === 0) rows = sampleRows.slice(0, 5);

    return {
      rows,
      columns: colNames,
      executionTimeMs: Number((Math.random() * 4 + 6).toFixed(1)),
      explainPlan: `Seq Scan on ${table.tableName} (cost=0.00..14.20 rows=${rows.length} width=128)`,
    };
  };

  const handleTranslate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nlPrompt.trim()) return;

    setIsTranslating(true);
    let success = false;
    try {
      const res = await safeFetchJson<SqlQueryResult>('/api/sql/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: nlPrompt,
          tableName: selectedTable.tableName,
          schemaColumns: selectedTable.columns,
          sampleRows: selectedTable.sampleRows || [],
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        setQueryResult(data);
        if (data.generatedSql) {
          setEditableSql(data.generatedSql);
        }
        setActiveResultTab('table');
        success = true;
      }
    } catch (err) {
      console.warn('Backend SQL translate endpoint unavailable, using client fallback engine:', err);
    }

    if (!success) {
      const clientResult = generateClientSql(nlPrompt, selectedTable);
      setQueryResult(clientResult);
      setEditableSql(clientResult.generatedSql);
      setActiveResultTab('table');
    }

    setIsTranslating(false);
  };

  // Direct SQL execution handler
  const handleExecuteQuery = async () => {
    setIsExecuting(true);
    let success = false;
    try {
      const res = await safeFetchJson<any>('/api/sql/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: editableSql,
          tableName: selectedTable.tableName,
          schemaColumns: selectedTable.columns,
          sampleRows: selectedTable.sampleRows || [],
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        setQueryResult((prev) => ({
          ...prev,
          generatedSql: editableSql,
          executionTimeMs: Number(data.executionTimeMs) || 12.4,
          columns: data.columns || prev.columns,
          rows: data.rows || prev.rows,
          explainPlan: data.explainPlan || prev.explainPlan,
        }));
        setActiveResultTab('table');
        success = true;
      }
    } catch (err) {
      console.warn('Backend SQL execute endpoint unavailable, using client fallback engine:', err);
    }

    if (!success) {
      const clientExec = executeClientSql(editableSql, selectedTable);
      setQueryResult((prev) => ({
        ...prev,
        generatedSql: editableSql,
        executionTimeMs: clientExec.executionTimeMs,
        columns: clientExec.columns,
        rows: clientExec.rows,
        explainPlan: clientExec.explainPlan,
      }));
      setActiveResultTab('table');
    }

    setIsExecuting(false);
  };

  // Copy SQL snippet
  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(editableSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Copy Table JSON
  const copyDataJson = () => {
    navigator.clipboard.writeText(JSON.stringify(queryResult.rows, null, 2));
    setCopiedData(true);
    setTimeout(() => setCopiedData(false), 2000);
  };

  // Download CSV
  const downloadCsv = () => {
    if (!queryResult.rows || queryResult.rows.length === 0) return;
    const cols = queryResult.columns || Object.keys(queryResult.rows[0]);
    const headerRow = cols.join(',');
    const bodyRows = queryResult.rows.map((row) =>
      cols.map((col) => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headerRow, ...bodyRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedTable.tableName}_query_output.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process uploaded CSV/JSON/SQL file
  const processUploadedFile = (file: File) => {
    setUploading(true);
    const fileName = file.name;
    const cleanTableName = fileName
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9_]/g, '_');

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setUploading(false);
        return;
      }

      let parsedColumns: Array<{ name: string; type: string }> = [];
      let parsedRows: Array<Record<string, any>> = [];

      try {
        if (fileName.endsWith('.json')) {
          const json = JSON.parse(text);
          const arrayData = Array.isArray(json) ? json : [json];
          if (arrayData.length > 0) {
            const keys = Object.keys(arrayData[0]);
            parsedColumns = keys.map((k) => {
              const val = arrayData[0][k];
              const type = typeof val === 'number' ? 'DECIMAL' : 'VARCHAR';
              return { name: k, type };
            });
            parsedRows = arrayData.slice(0, 20);
          }
        } else {
          // Standard CSV parser
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 0) {
            const headerCols = lines[0].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
            parsedRows = lines.slice(1, 21).map((line) => {
              const rowValues = line.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
              const rowObj: Record<string, any> = {};
              headerCols.forEach((col, idx) => {
                const val = rowValues[idx] ?? '';
                const numVal = Number(val);
                rowObj[col] = !isNaN(numVal) && val !== '' ? numVal : val;
              });
              return rowObj;
            });

            // Infer column data types
            parsedColumns = headerCols.map((colName) => {
              const sampleVal = parsedRows[0]?.[colName];
              let type = 'VARCHAR';
              if (typeof sampleVal === 'number') {
                type = Number.isInteger(sampleVal) ? 'INTEGER' : 'DECIMAL';
              } else if (String(sampleVal).match(/^\d{4}-\d{2}-\d{2}/)) {
                type = 'TIMESTAMP';
              }
              return { name: colName, type };
            });
          }
        }

        if (parsedColumns.length === 0) {
          parsedColumns = [
            { name: 'id', type: 'UUID' },
            { name: 'record_name', type: 'VARCHAR' },
            { name: 'metric_value', type: 'DECIMAL' },
            { name: 'created_at', type: 'TIMESTAMP' },
          ];
          parsedRows = [
            { id: '1', record_name: 'Sample Row 1', metric_value: 1250, created_at: '2026-01-01' },
            { id: '2', record_name: 'Sample Row 2', metric_value: 3400, created_at: '2026-01-02' },
          ];
        }

        const newTable: DatabaseTable = {
          tableName: cleanTableName || 'custom_dataset',
          rowCount: parsedRows.length > 0 ? parsedRows.length : 120,
          columns: parsedColumns,
          sampleRows: parsedRows,
        };

        setTables((prev) => [newTable, ...prev]);
        setSelectedTable(newTable);

        // Auto generate sample prompt for uploaded dataset
        const numCol = parsedColumns.find((c) => c.type === 'DECIMAL' || c.type === 'INTEGER')?.name;
        const strCol = parsedColumns.find((c) => c.type === 'VARCHAR')?.name;

        let autoPrompt = `Show all rows from ${newTable.tableName}`;
        if (numCol && strCol) {
          autoPrompt = `Show top records in ${newTable.tableName} sorted by ${numCol} descending`;
        } else if (numCol) {
          autoPrompt = `Calculate the total and average ${numCol} in ${newTable.tableName}`;
        }

        setNlPrompt(autoPrompt);

        // Pre-populate query result for uploaded table
        const firstCols = parsedColumns.map((c) => c.name);
        setQueryResult({
          naturalPrompt: autoPrompt,
          generatedSql: `SELECT ${firstCols.slice(0, 6).join(', ')}\nFROM ${newTable.tableName}\nORDER BY ${numCol || firstCols[0]} DESC\nLIMIT 10;`,
          explainPlan: `Seq Scan on ${newTable.tableName} (cost=0.00..14.20 rows=${parsedRows.length} width=128)`,
          executionTimeMs: 11.2,
          columns: firstCols,
          rows: parsedRows,
          chartRecommendation: 'bar',
        });

        setUploadSuccessMsg(`Successfully imported dataset "${fileName}" with ${parsedColumns.length} columns!`);
        setShowUploadModal(false);
        setTimeout(() => setUploadSuccessMsg(''), 4000);
      } catch (err) {
        console.error('File parsing error:', err);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Determine chart X and Y keys dynamically
  const getChartKeys = () => {
    const currentRows = queryResult.rows && queryResult.rows.length > 0 ? queryResult.rows : selectedTable.sampleRows || [];
    if (currentRows.length === 0) return { xAxisKey: 'name', yAxisKey: 'value' };

    const firstRow = currentRows[0];
    const keys = Object.keys(firstRow);

    const strKey = keys.find((k) => typeof firstRow[k] === 'string') || keys[0] || 'name';
    const numKey = keys.find((k) => typeof firstRow[k] === 'number') || keys[1] || 'value';

    return { xAxisKey: strKey, yAxisKey: numKey };
  };

  const { xAxisKey, yAxisKey } = getChartKeys();

  // Helper to categorize tables
  const getTableCategory = (name: string) => {
    switch (name) {
      case 'customers':
        return { label: 'Customers', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'store_orders':
        return { label: 'Sales', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'products_catalog':
        return { label: 'Inventory', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'employee_directory':
        return { label: 'HR', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'property_listings':
        return { label: 'Real Estate', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'ad_campaigns':
        return { label: 'Marketing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: 'Custom', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // Dynamic suggested queries per table
  const getTableSuggestions = (table: DatabaseTable) => {
    switch (table.tableName) {
      case 'customers':
        return [
          'Show top 5 VIP customers sorted by total spend',
          'Count total customers grouped by country and membership tier',
          'Find customers with total spend over $3,000',
        ];
      case 'store_orders':
        return [
          'Show top 5 orders by total price with customer names',
          'Calculate total revenue grouped by order status',
          'Count total orders for Noise-Canceling Headphones',
        ];
      case 'products_catalog':
        return [
          'List products with rating >= 4.7 sorted by stock level',
          'Show average unit price by product category',
          'Find products with low stock quantity (< 50)',
        ];
      case 'employee_directory':
        return [
          'List top 5 highest paid employees sorted by salary',
          'Calculate average salary grouped by department',
          'Show employees hired after January 2023',
        ];
      case 'property_listings':
        return [
          'Find active property listings with price under $600,000',
          'Calculate average price per sqft grouped by city',
          'Show properties with 4 or more bedrooms',
        ];
      case 'ad_campaigns':
        return [
          'List top campaigns sorted by revenue generated',
          'Calculate total ad spend and conversions grouped by platform channel',
          'Find campaigns with return on ad spend greater than 4x',
        ];
      default:
        return [
          `Show top 5 records from ${table.tableName}`,
          `Count total records in ${table.tableName}`,
          `List distinct values in ${table.columns[0]?.name || 'id'}`,
        ];
    }
  };

  const filteredTables = tables.filter((t) =>
    t.tableName.toLowerCase().includes(tableSearchTerm.toLowerCase()) ||
    (t.friendlyName && t.friendlyName.toLowerCase().includes(tableSearchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
              <Terminal className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Natural Language SQL & Business Intelligence</h1>
          </div>
          <p className="text-xs text-slate-500">
            Convert plain English questions directly into PostgreSQL queries with automatic EXPLAIN plans & charts.
          </p>
        </div>

        {/* Upload Dataset Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 shrink-0 border border-cyan-700"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Custom Dataset</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {uploadSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Main Studio Layout: Table Browser & Query Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Schema Table Browser (1 col) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-600" />
              <h2 className="text-sm font-bold text-slate-900">Dataset Tables</h2>
              <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full font-bold border border-cyan-200">
                {tables.length}
              </span>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-[11px] font-bold text-cyan-700 hover:text-cyan-600 flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Dataset</span>
            </button>
          </div>

          {/* Quick Table Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tableSearchTerm}
              onChange={(e) => setTableSearchTerm(e.target.value)}
              placeholder="Search datasets or tables..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Friendly Table Selection List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredTables.map((tbl) => {
              const isSelected = selectedTable.tableName === tbl.tableName;
              const cat = getTableCategory(tbl.tableName);
              const displayName = tbl.friendlyName || tbl.tableName;
              return (
                <button
                  key={tbl.tableName}
                  onClick={() => {
                    setSelectedTable(tbl);
                    const numCol = tbl.columns.find((c) =>
                      c.type.toLowerCase().includes('decimal') ||
                      c.type.toLowerCase().includes('integer') ||
                      c.type.toLowerCase().includes('numeric')
                    )?.name;
                    const strCol = tbl.columns.find((c) =>
                      c.type.toLowerCase().includes('char') ||
                      c.type.toLowerCase().includes('text')
                    )?.name;
                    let prompt = `Show rows from ${displayName}`;
                    if (numCol && strCol) {
                      prompt = `Show top records in ${displayName} sorted by ${numCol} descending`;
                    }
                    setNlPrompt(prompt);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-50/90 border-cyan-400 text-cyan-950 font-semibold shadow-xs'
                      : 'bg-slate-50/60 border-slate-200/60 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 leading-snug truncate">{displayName}</span>
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${cat.color} shrink-0 whitespace-nowrap`}>
                      {cat.label}
                    </span>
                  </div>
                  
                  {tbl.description && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 mb-2 font-normal">
                      {tbl.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px] truncate max-w-[130px]">
                      {tbl.tableName}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500 whitespace-nowrap">
                      {tbl.columns.length} fields · {tbl.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                No datasets found matching "{tableSearchTerm}"
              </div>
            )}
          </div>

          {/* Selected Table Overview & Column Schema Viewer */}
          <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {selectedTable.friendlyName || selectedTable.tableName}
                </span>
                <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 whitespace-nowrap">
                  {selectedTable.tableName}
                </span>
              </div>
              {selectedTable.description && (
                <p className="text-[11px] text-slate-600 leading-normal">
                  {selectedTable.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Field Schema ({selectedTable.columns.length} Columns)
              </span>
              <button
                onClick={() => setShowRawDataPreview(!showRawDataPreview)}
                className="text-[10px] font-bold text-cyan-700 hover:text-cyan-600 flex items-center space-x-1 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Eye className="w-3 h-3" />
                <span>{showRawDataPreview ? 'Hide Sample' : 'View Sample Rows'}</span>
              </button>
            </div>

            {/* Schema Column List */}
            {!showRawDataPreview ? (
              <div className="space-y-1.5 pt-0.5 max-h-60 overflow-y-auto pr-1">
                {selectedTable.columns.map((col) => (
                  <div key={col.name} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-cyan-300 transition-colors space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        {col.isPrimaryKey && (
                          <span title="Primary Key Identifier">
                            <Key className="w-3 h-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {col.friendlyName || col.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-semibold text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200/80 shrink-0 whitespace-nowrap">
                        {col.typeLabel || col.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="text-[10px] text-slate-600 font-mono truncate">{col.name}</span>
                      <span className="text-[9px] text-slate-400 shrink-0 ml-2">{col.type}</span>
                    </div>

                    {col.description && (
                      <p className="text-[10px] text-slate-500 pt-0.5 border-t border-slate-200/50 truncate" title={col.description}>
                        {col.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Styled Sample Data Table Inspector */
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-56 bg-white">
                {selectedTable.sampleRows && selectedTable.sampleRows.length > 0 ? (
                  <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[9px] tracking-wider sticky top-0">
                        <th className="py-2 px-2.5 text-slate-400 border-r border-slate-200 w-8 text-center sticky left-0 bg-slate-100 z-10">#</th>
                        {selectedTable.columns.slice(0, 5).map((col) => (
                          <th key={col.name} className="py-2 px-2.5 border-r border-slate-200 font-mono">
                            {col.friendlyName || col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {selectedTable.sampleRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-cyan-50/30 transition-colors">
                          <td className="py-1.5 px-2.5 text-slate-400 font-mono text-[9px] text-center bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10">
                            {idx + 1}
                          </td>
                          {selectedTable.columns.slice(0, 5).map((col) => (
                            <td key={col.name} className="py-1.5 px-2.5 border-r border-slate-100 text-slate-700 font-mono text-[10px]">
                              {String(row[col.name] ?? '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 italic">No sample rows preloaded.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* NL Input & Output Sandbox (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Natural Language Prompt Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400 flex items-center space-x-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask Business Question in Natural Language</span>
              </span>
              <span className="text-[11px] font-mono text-cyan-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                Table: {selectedTable.tableName}
              </span>
            </div>

            <form onSubmit={handleTranslate} className="flex gap-3">
              <input
                type="text"
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                placeholder={`Ask anything about ${selectedTable.tableName}...`}
                className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 transition-all"
              />
              <button
                type="submit"
                disabled={isTranslating}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isTranslating ? 'Generating...' : 'Generate SQL'}</span>
              </button>
            </form>

            {/* Prompt Suggestion Chips */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] font-medium flex items-center space-x-1 mr-1">
                <HelpCircle className="w-3 h-3 text-cyan-400" />
                <span>Suggested Queries:</span>
              </span>
              {getTableSuggestions(selectedTable).map((chipPrompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setNlPrompt(chipPrompt);
                    handleTranslate();
                  }}
                  className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] transition-all cursor-pointer text-left"
                >
                  "{chipPrompt}"
                </button>
              ))}
            </div>
          </div>

          {/* Generated SQL Code & Direct Execution Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  SQL Query Editor
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={copySqlToClipboard}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center space-x-1 border border-slate-700 transition-colors"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>

                {/* Primary RUN QUERY Button */}
                <button
                  onClick={handleExecuteQuery}
                  disabled={isExecuting}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center space-x-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isExecuting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isExecuting ? 'Running Query...' : 'Run Query'}</span>
                </button>
              </div>
            </div>

            {/* Editable SQL Text Area */}
            <textarea
              value={editableSql}
              onChange={(e) => setEditableSql(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 text-cyan-300 p-4 rounded-xl text-xs font-mono border border-slate-800 focus:outline-none focus:border-cyan-500 leading-relaxed resize-none"
              placeholder="Enter PostgreSQL query..."
            />
          </div>

          {/* Query Results & Execution Output Display */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            {/* Results Header with View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900">Query Execution Output</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  {queryResult.executionTimeMs}ms
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {queryResult.rows ? queryResult.rows.length : 0} Rows Returned
                </span>
              </div>

              {/* View Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setActiveResultTab('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeResultTab === 'table'
                      ? 'bg-white text-cyan-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Table View</span>
                </button>

                <button
                  onClick={() => setActiveResultTab('chart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeResultTab === 'chart'
                      ? 'bg-white text-cyan-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Chart View</span>
                </button>

                <button
                  onClick={() => setActiveResultTab('explain')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeResultTab === 'explain'
                      ? 'bg-white text-cyan-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-600" />
                  <span>EXPLAIN</span>
                </button>
              </div>
            </div>

            {/* TAB 1: TABULAR DATA OUTPUT GRID */}
            {activeResultTab === 'table' && (
              <div className="space-y-3 animate-fadeIn">
                {/* Table Control Bar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-grow max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      placeholder="Filter returned rows..."
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={copyDataJson}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1 transition-colors border border-slate-200 cursor-pointer"
                    >
                      {copiedData ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={downloadCsv}
                      className="px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-semibold flex items-center space-x-1 transition-colors border border-cyan-200 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-700" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Styled Table Data Grid */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-80 bg-white scrollbar-thin">
                  <table className="w-full min-w-max text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-slate-100/95 border-b border-slate-200 text-slate-700 font-bold sticky top-0 z-20 backdrop-blur-xs">
                      <tr>
                        <th className="py-2.5 px-3 text-slate-500 border-r border-slate-200 w-12 text-center sticky left-0 bg-slate-100 z-30 font-mono text-[10px]">#</th>
                        {(queryResult.columns || []).map((col) => {
                          const matchedCol = selectedTable.columns.find((c) => c.name === col);
                          return (
                            <th key={col} className="py-2.5 px-4 border-r border-slate-200 min-w-[130px]">
                              <div className="font-sans font-bold text-slate-900 normal-case text-xs leading-tight">
                                {matchedCol?.friendlyName || col}
                              </div>
                              <div className="font-mono text-[9px] text-slate-400 font-normal mt-0.5">
                                {col}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
                      {queryResult.rows && queryResult.rows.filter((row) => {
                        if (!tableFilter.trim()) return true;
                        return Object.values(row).some((val) =>
                          String(val).toLowerCase().includes(tableFilter.toLowerCase())
                        );
                      }).length > 0 ? (
                        queryResult.rows
                          .filter((row) => {
                            if (!tableFilter.trim()) return true;
                            return Object.values(row).some((val) =>
                              String(val).toLowerCase().includes(tableFilter.toLowerCase())
                            );
                          })
                          .map((row, idx) => (
                            <tr key={idx} className="even:bg-slate-50/50 hover:bg-cyan-50/50 transition-colors">
                              <td className="py-2 px-3 text-slate-400 font-mono text-[10px] text-center bg-slate-50 border-r border-slate-200 sticky left-0 z-10 font-medium">
                                {idx + 1}
                              </td>
                              {(queryResult.columns || Object.keys(row)).map((col) => {
                                const val = row[col];
                                const isNum = typeof val === 'number';
                                return (
                                  <td key={col} className="py-2 px-4 border-r border-slate-100 font-sans">
                                    {isNum ? (
                                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                        {val.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-slate-700">{String(val ?? '')}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td
                            colSpan={(queryResult.columns?.length || 1) + 1}
                            className="py-8 text-center text-slate-400 text-xs italic"
                          >
                            No matching records found in execution results.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: VISUAL CHART VIEW */}
            {activeResultTab === 'chart' && (
              <div className="space-y-3 animate-fadeIn pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Autogenerated Graphic Visualization</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    X: <span className="font-bold text-slate-800">{xAxisKey}</span> | Y: <span className="font-bold text-slate-800">{yAxisKey}</span>
                  </span>
                </div>
                <div className="h-64 w-full bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryResult.rows} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey={xAxisKey} tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any) => [val, yAxisKey]} />
                      <Bar dataKey={yAxisKey} fill="#06B6D4" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TAB 3: EXPLAIN PLAN VIEW */}
            {activeResultTab === 'explain' && (
              <div className="space-y-3 animate-fadeIn pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      PostgreSQL EXPLAIN (ANALYZE, BUFFERS, VERBOSE) Execution Tree
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Optimizer node cost estimates, memory allocation & buffer hit statistics
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(queryResult.explainPlan || '');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center space-x-1 border border-slate-200 cursor-pointer self-start sm:self-auto"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Plan</span>
                  </button>
                </div>

                {/* KPI Metrics Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Scan Method</span>
                    <span className="text-xs font-bold text-cyan-700 font-mono">
                      {queryResult.generatedSql?.toUpperCase().includes('WHERE') ? 'Index Scan (B-Tree)' : 'Seq Scan (Parallel)'}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Estimated Cost</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">0.15 .. 12.15</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Shared Buffer Hit</span>
                    <span className="text-xs font-bold text-emerald-600 font-mono">100% (Cache Hit)</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Planning vs Exec</span>
                    <span className="text-xs font-bold text-indigo-700 font-mono">0.14ms / {queryResult.executionTimeMs}ms</span>
                  </div>
                </div>

                {/* Formatted PostgreSQL Execution Plan Output */}
                <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono border border-slate-800 leading-relaxed overflow-x-auto shadow-inner">
                  <pre className="whitespace-pre">{queryResult.explainPlan || 'No execution plan generated.'}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dataset Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Custom Dataset</h3>
                  <p className="text-xs text-slate-500">Import CSV, JSON, or SQL schema datasets</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-cyan-500 bg-cyan-50/50'
                  : 'border-slate-300 hover:border-cyan-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.sql,.txt"
                onChange={(e) => e.target.files?.[0] && processUploadedFile(e.target.files[0])}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    Click to browse or drop file here
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports <span className="font-mono text-cyan-700 font-semibold">.CSV</span>, <span className="font-mono text-cyan-700 font-semibold">.JSON</span>, or <span className="font-mono text-cyan-700 font-semibold">.SQL</span> (up to 50MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Datasets Quick Loader */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Or load a sample dataset instantly:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    const sampleFile = new File(
                      [
                        `customer_id,company_name,industry,annual_revenue,churn_risk\nc101,AeroCorp,Aerospace,4500000,0.12\nc102,BioTech Labs,Healthcare,8200000,0.68\nc103,FinPay Global,Finance,12000000,0.05\nc104,EduCloud,Education,2100000,0.42`
                      ],
                      'Enterprise_Customers_2026.csv',
                      { type: 'text/csv' }
                    );
                    processUploadedFile(sampleFile);
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 rounded-xl text-left transition-all"
                >
                  <div className="font-bold text-slate-800 text-[11px]">Enterprise_Customers.csv</div>
                  <div className="text-[10px] text-slate-400">4 columns • 5 rows</div>
                </button>

                <button
                  onClick={() => {
                    const sampleFile = new File(
                      [
                        `product_id,product_name,category,units_sold,total_sales_usd\np1,Nexus Agentic OS,Software,1420,710000\np2,AutoML Pipeline,SaaS,890,445000\np3,Vector DB Cluster,Cloud,620,310000`
                      ],
                      'Product_Sales_Q3.csv',
                      { type: 'text/csv' }
                    );
                    processUploadedFile(sampleFile);
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 rounded-xl text-left transition-all"
                >
                  <div className="font-bold text-slate-800 text-[11px]">Product_Sales_Q3.csv</div>
                  <div className="text-[10px] text-slate-400">5 columns • 3 rows</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

