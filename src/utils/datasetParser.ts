export interface ColumnStat {
  name: string;
  type: 'numeric' | 'categorical' | 'boolean' | 'text';
  nullCount: number;
  min?: number;
  max?: number;
  mean?: number;
  uniqueCount?: number;
  topValue?: string;
  topCount?: number;
}

export interface UploadedDatasetInfo {
  fileName: string;
  fileSize: string;
  fileType: string;
  rowCount: number;
  colCount: number;
  columns: string[];
  columnTypes: Record<string, 'numeric' | 'categorical' | 'boolean' | 'text'>;
  stats: ColumnStat[];
  sampleRows: Record<string, any>[];
  rawSummaryText: string;
}

/**
 * Format bytes to human readable string (e.g. 24.5 KB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parses a CSV line respecting quoted values
 */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Parse an uploaded file (CSV, TSV, JSON, TXT) into a structured dataset summary
 */
export async function parseUploadedDataset(file: File): Promise<UploadedDatasetInfo> {
  const text = await file.text();
  const fileName = file.name;
  const fileSize = formatBytes(file.size);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  let columns: string[] = [];
  let sampleRows: Record<string, any>[] = [];
  let totalRows = 0;

  if (ext === 'json') {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      totalRows = arr.length;
      if (arr.length > 0) {
        columns = Object.keys(arr[0]);
        sampleRows = arr.slice(0, 10);
      }
    } catch {
      // Fallback text line parsing
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      columns = ['Line'];
      totalRows = lines.length;
      sampleRows = lines.slice(0, 10).map((l, i) => ({ Line: `Row ${i + 1}`, Content: l.slice(0, 80) }));
    }
  } else {
    // CSV, TSV, TXT parsing
    const delimiter = ext === 'tsv' ? '\t' : text.includes('\t') && !text.includes(',') ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length > 0) {
      columns = parseCsvLine(lines[0], delimiter);
      const dataLines = lines.slice(1);
      totalRows = dataLines.length;

      for (let i = 0; i < Math.min(dataLines.length, 500); i++) {
        const values = parseCsvLine(dataLines[i], delimiter);
        const rowObj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          const val = values[idx] ?? '';
          rowObj[col] = val;
        });
        if (i < 10) {
          sampleRows.push(rowObj);
        }
      }
    }
  }

  // Infer column types & compute stats
  const columnTypes: Record<string, 'numeric' | 'categorical' | 'boolean' | 'text'> = {};
  const stats: ColumnStat[] = [];

  columns.forEach((col) => {
    let nullCount = 0;
    const numValues: number[] = [];
    const valueCounts: Record<string, number> = {};

    sampleRows.forEach((row) => {
      const val = row[col];
      if (val === undefined || val === null || val === '' || val === 'NA' || val === 'null') {
        nullCount++;
      } else {
        const valStr = String(val).trim();
        valueCounts[valStr] = (valueCounts[valStr] || 0) + 1;
        const num = Number(valStr);
        if (!isNaN(num) && valStr !== '') {
          numValues.push(num);
        }
      }
    });

    const isNumeric = numValues.length > 0 && numValues.length >= sampleRows.length * 0.5;
    const isBool = Object.keys(valueCounts).every((v) => ['true', 'false', '0', '1', 'yes', 'no'].includes(v.toLowerCase()));

    let type: 'numeric' | 'categorical' | 'boolean' | 'text' = 'categorical';
    if (isBool) type = 'boolean';
    else if (isNumeric) type = 'numeric';
    else if (Object.keys(valueCounts).length > 20) type = 'text';

    columnTypes[col] = type;

    const stat: ColumnStat = {
      name: col,
      type,
      nullCount,
    };

    if (isNumeric && numValues.length > 0) {
      stat.min = Math.min(...numValues);
      stat.max = Math.max(...numValues);
      const sum = numValues.reduce((a, b) => a + b, 0);
      stat.mean = Number((sum / numValues.length).toFixed(2));
    }

    const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
    if (sortedValues.length > 0) {
      stat.topValue = sortedValues[0][0];
      stat.topCount = sortedValues[0][1];
      stat.uniqueCount = sortedValues.length;
    }

    stats.push(stat);
  });

  // Construct readable raw summary text for LLM/agent context
  const summaryLines: string[] = [
    `[Uploaded Dataset Context]`,
    `Filename: ${fileName} (${fileSize}, ${totalRows.toLocaleString()} rows, ${columns.length} columns)`,
    `Columns (${columns.length}): ${columns.join(', ')}`,
    ``,
    `Data Types & Feature Statistics:`,
  ];

  stats.forEach((s) => {
    if (s.type === 'numeric') {
      summaryLines.push(`- **${s.name}** (Numeric): Min: ${s.min} | Max: ${s.max} | Average: ${s.mean} | Missing: ${s.nullCount}`);
    } else {
      summaryLines.push(`- **${s.name}** (Categorical): ${s.uniqueCount || 0} Unique Category Value(s) | Top: "${s.topValue || ''}" (${s.topCount || 0} rows) | Missing: ${s.nullCount}`);
    }
  });

  if (sampleRows.length > 0) {
    summaryLines.push('');
    summaryLines.push(`Sample Preview (First 3 rows):`);
    summaryLines.push('```json');
    summaryLines.push(JSON.stringify(sampleRows.slice(0, 3), null, 2));
    summaryLines.push('```');
  }

  return {
    fileName,
    fileSize,
    fileType: ext.toUpperCase(),
    rowCount: totalRows,
    colCount: columns.length,
    columns,
    columnTypes,
    stats,
    sampleRows,
    rawSummaryText: summaryLines.join('\n'),
  };
}
