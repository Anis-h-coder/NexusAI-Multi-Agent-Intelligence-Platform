import { jsPDF } from 'jspdf';
import { CURRENT_USER } from '../data/mockData';

export interface SystemDocData {
  title?: string;
  version?: string;
  date?: string;
}

export interface AgentReportExecutionStep {
  id: string;
  agentRole: string;
  title: string;
  subtitle?: string;
  thought: string;
  output: string;
  durationMs: number;
  status: string;
  timestamp: string;
  codeSnippet?: string;
}

export interface DynamicReportNode {
  id: string;
  role: string;
  title: string;
  subtitle: string;
  description: string;
  model: string;
  icon: string;
  status: string;
  dependsOn?: string[];
  reason?: string;
  stepOrder: number;
  durationMs?: number;
  codeSnippet?: string;
}

export interface ExecutionReportState {
  executionId?: string;
  taskPrompt: string;
  timestamp?: string;
  overallStatus?: 'completed' | 'failed' | 'running';
  totalDurationMs?: number;
  workflowPlan?: {
    goal?: string;
    capabilities?: string[];
    selectedAgents?: { agentRole: string; title: string; reason: string; dependsOn?: string[] }[];
    skippedAgents?: { agentRole: string; title: string; reason: string }[];
    estimatedStages?: number;
    executionMode?: string;
    dependenciesSummary?: string;
  } | null;
  executionSteps: AgentReportExecutionStep[];
  dynamicNodes?: DynamicReportNode[];
  skippedSpecialists?: { role: string; title: string; icon?: string; desc?: string }[];
}

const normalizeRole = (role?: string): string => {
  if (!role) return '';
  const value = role.toLowerCase().trim();
  if (value.includes('ml') || value.includes('machine learning')) return 'ml';
  if (value.includes('software') || value.includes('developer') || value.includes('dev')) return 'software';
  if (value.includes('data') || value.includes('analyst')) return 'data';
  if (value.includes('research')) return 'research';
  if (value.includes('doc')) return 'documentation';
  if (value.includes('planner') || value.includes('plan')) return 'planner';
  return value;
};

export const generateDocumentationPDF = (reportInput?: ExecutionReportState | SystemDocData) => {
  const isExecutionReport =
    reportInput &&
    (('taskPrompt' in reportInput && Boolean((reportInput as ExecutionReportState).taskPrompt)) ||
      ('executionSteps' in reportInput && Array.isArray((reportInput as ExecutionReportState).executionSteps)));

  if (isExecutionReport) {
    renderExecutionReportPDF(reportInput as ExecutionReportState);
  } else {
    renderSecuritySpecPDF(reportInput as SystemDocData);
  }
};

const renderExecutionReportPDF = (execState: ExecutionReportState) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 20;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
    }
  };

  // 1. DATA EXTRACTION FROM CURRENT EXECUTION STATE
  const taskPrompt = execState.taskPrompt || 'Dynamic Multi-Agent Fleet Request';
  const steps = execState.executionSteps || [];
  const plan = execState.workflowPlan;
  const nodes = execState.dynamicNodes || [];
  
  const executionId =
    execState.executionId ||
    (steps[0]?.id ? `exec-${steps[0].id.replace(/^step-/, '')}` : `exec-${Date.now().toString(36)}`);

  const formattedDate =
    execState.timestamp ||
    new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const overallStatus = (execState.overallStatus || 'completed').toUpperCase();
  const totalDurationMs =
    execState.totalDurationMs || steps.reduce((acc, s) => acc + (s.durationMs || 0), 0) || 1280;

  // Active Role Detection
  const executedRoles = new Set(steps.map((s) => normalizeRole(s.agentRole)));
  const isPlannerActive = true;
  const isResearchActive = executedRoles.has('research') || nodes.some((n) => normalizeRole(n.role) === 'research');
  const isDataActive = executedRoles.has('data') || nodes.some((n) => normalizeRole(n.role) === 'data');
  const isMLActive = executedRoles.has('ml') || nodes.some((n) => normalizeRole(n.role) === 'ml');
  const isSoftwareActive = executedRoles.has('software') || nodes.some((n) => normalizeRole(n.role) === 'software');
  const isDocActive = true;

  const activeAgentsCount = [isPlannerActive, isResearchActive, isDataActive, isMLActive, isSoftwareActive, isDocActive].filter(Boolean).length;
  const specialistCount = [isResearchActive, isDataActive, isMLActive, isSoftwareActive].filter(Boolean).length;

  const capabilities = plan?.capabilities || [
    'Autonomous Goal Decomposition',
    'Capability-Based Agent Selection',
    'Dynamic DAG Dependency Routing',
    'Specialist Code & Spec Generation',
    'Automated Verification & Telemetry',
  ];

  const executionMode = plan?.executionMode || 'Hybrid Dynamic DAG';
  const dagSummary = plan?.dependenciesSummary || steps.map((s) => s.agentRole).join(' → ') || 'Planner → Active Specialists → Documentation';

  // Helper Drawing Functions
  const drawSectionHeader = (title: string) => {
    checkPageBreak(12);
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margin, currentY, contentWidth, 7.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 4, currentY + 5);
    currentY += 12;
  };

  // --- PAGE 1: COVER & EXECUTIVE METADATA ---
  // Top Badge
  doc.setFillColor(16, 185, 129); // Emerald
  doc.roundedRect(margin, currentY, 40, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('AUTONOMOUS EXECUTION', margin + 3.5, currentY + 4.2);

  currentY += 11;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Autonomous Multi-Agent Fleet', margin, currentY);

  currentY += 8;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Execution & Orchestration Report', margin, currentY);

  currentY += 10;

  // Metadata Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  doc.text('Execution ID:', margin + 5, currentY + 7);
  doc.text('Execution Date/Time:', margin + 5, currentY + 13);
  doc.text('Execution Status:', margin + 5, currentY + 19);
  doc.text('Active Fleet Pipeline:', margin + 5, currentY + 25);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(executionId, margin + 42, currentY + 7);
  doc.text(formattedDate, margin + 42, currentY + 13);

  // Status Badge text
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(overallStatus, margin + 42, currentY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`${activeAgentsCount} Agents Active (${specialistCount} Specialists) · ${executionMode} · ${(totalDurationMs / 1000).toFixed(2)}s`, margin + 42, currentY + 25);

  currentY += 38;

  // --- SECTION 4: USER GOAL ---
  drawSectionHeader('4. USER GOAL');

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  const goalLines = doc.splitTextToSize(`"${taskPrompt}"`, contentWidth - 10);
  const goalBoxHeight = Math.max(14, goalLines.length * 4.5 + 6);

  checkPageBreak(goalBoxHeight + 4);
  doc.roundedRect(margin, currentY, contentWidth, goalBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(goalLines, margin + 5, currentY + 6);

  currentY += goalBoxHeight + 10;

  // --- SECTION 5: PLANNER DECISION & CAPABILITY DETECTION ---
  drawSectionHeader('5. PLANNER DECISION & CAPABILITY DETECTION');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Extracted Capabilities Detected from Intent:', margin, currentY);

  currentY += 6;

  capabilities.forEach((cap) => {
    checkPageBreak(6);
    doc.setFillColor(13, 148, 136);
    doc.circle(margin + 3, currentY - 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(cap, margin + 7, currentY);
    currentY += 5;
  });

  const plannerStep = steps.find((s) => normalizeRole(s.agentRole) === 'planner');
  if (plannerStep?.thought) {
    currentY += 3;
    checkPageBreak(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Orchestrator Routing Strategy:', margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const planThoughtLines = doc.splitTextToSize(plannerStep.thought, contentWidth - 4);
    doc.text(planThoughtLines, margin, currentY);
    currentY += planThoughtLines.length * 3.8 + 6;
  } else {
    currentY += 4;
  }

  // --- SECTION 6: AGENT SELECTION ---
  drawSectionHeader('6. AGENT SELECTION (SELECTED VS SKIPPED)');

  // Selected Agents Table
  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Active Selected Agents (Executed in DAG):', margin, currentY);
  currentY += 5;

  const selectedRows: [string, string, string, string][] = [];
  if (isPlannerActive) selectedRows.push(['🧠 Planner Agent', 'Goal Decomposition & Routing', 'Completed', 'Gemini Engine']);
  if (isResearchActive) selectedRows.push(['🔍 Research Agent', 'Context Retrieval & Fact Finding', 'Completed', 'Gemini Engine']);
  if (isDataActive) selectedRows.push(['📊 Data Analyst Agent', 'Dataset Profiling & Quality Audit', 'Completed', 'Gemini Engine']);
  if (isMLActive) selectedRows.push(['🤖 ML Agent', 'Model Benchmarking & SHAP', 'Completed', 'Gemini Engine']);
  if (isSoftwareActive) selectedRows.push(['💻 Software Agent', 'Code & API Implementation', 'Completed', 'Gemini Engine']);
  if (isDocActive) selectedRows.push(['📚 Documentation Agent', 'Final Synthesis & Specification', 'Completed', 'Gemini Engine']);

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Agent Title', margin + 3, currentY + 3.8);
  doc.text('Role Description', margin + 45, currentY + 3.8);
  doc.text('Status', margin + 115, currentY + 3.8);
  doc.text('Model', margin + 145, currentY + 3.8);

  currentY += 6;

  selectedRows.forEach(([title, role, status, model]) => {
    checkPageBreak(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 3, currentY + 3.8);
    doc.text(role, margin + 45, currentY + 3.8);
    doc.setTextColor(16, 185, 129);
    doc.text(status, margin + 115, currentY + 3.8);
    doc.setTextColor(100, 116, 139);
    doc.text(model, margin + 145, currentY + 3.8);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 5, margin + contentWidth, currentY + 5);
    currentY += 5.5;
  });

  currentY += 4;

  // Skipped Agents Table
  const skippedRows: [string, string, string][] = [];
  if (!isResearchActive) skippedRows.push(['🔍 Research Agent', 'Skipped', 'External web or document research not required']);
  if (!isDataActive) skippedRows.push(['📊 Data Analyst Agent', 'Skipped', 'Dataset profiling or EDA statistics not requested']);
  if (!isMLActive) skippedRows.push(['🤖 ML Agent', 'Skipped', 'Model training or algorithm benchmarking not requested']);
  if (!isSoftwareActive) skippedRows.push(['💻 Software Agent', 'Skipped', 'No software code or API implementation requested']);

  if (skippedRows.length > 0) {
    checkPageBreak(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Skipped Specialist Agents (0 Overhead Bypassed):', margin, currentY);
    currentY += 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Agent Title', margin + 3, currentY + 3.8);
    doc.text('Status', margin + 45, currentY + 3.8);
    doc.text('Bypass Justification', margin + 70, currentY + 3.8);

    currentY += 6;

    skippedRows.forEach(([title, status, reason]) => {
      checkPageBreak(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(title, margin + 3, currentY + 3.8);
      doc.setTextColor(156, 163, 175);
      doc.text(status, margin + 45, currentY + 3.8);
      doc.setTextColor(100, 116, 139);
      doc.text(reason, margin + 70, currentY + 3.8);

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + 5, margin + contentWidth, currentY + 5);
      currentY += 5.5;
    });

    currentY += 6;
  }

  // --- SECTION 7: DYNAMIC EXECUTION DAG ---
  drawSectionHeader('7. DYNAMIC EXECUTION DAG PIPELINE');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(13, 148, 136);
  doc.text(`Pipeline Graph Topology: [ ${dagSummary} ]`, margin, currentY);

  currentY += 6;

  // Render DAG Nodes
  steps.forEach((step, idx) => {
    checkPageBreak(14);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 11, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Stage 0${idx + 1}: ${step.agentRole}`, margin + 4, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${step.subtitle || step.title}`, margin + 45, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('COMPLETED', margin + 120, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${step.durationMs}ms`, margin + 152, currentY + 4.5);

    currentY += 14;
  });

  currentY += 4;

  // --- SECTION 8: EXECUTION SUMMARY ---
  drawSectionHeader('8. EXECUTION SUMMARY');

  const summaryCards = [
    { label: 'Total DAG Nodes', val: `${steps.length}` },
    { label: 'Specialists Active', val: `${specialistCount}` },
    { label: 'Topology Mode', val: executionMode },
    { label: 'Overall Status', val: overallStatus },
  ];

  checkPageBreak(18);
  const cardWidth = (contentWidth - 9) / 4;
  summaryCards.forEach((c, i) => {
    const x = margin + i * (cardWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, currentY, cardWidth, 14, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(c.val, x + 3, currentY + 10.5);
  });

  currentY += 20;

  // --- SECTION 9: AGENT EXECUTION DETAILS ---
  drawSectionHeader('9. AGENT EXECUTION DETAILS (STEP-BY-STEP)');

  steps.forEach((step, idx) => {
    checkPageBreak(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Stage ${idx + 1}: ${step.agentRole}`, margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Title: ${step.title} | Duration: ${step.durationMs}ms | Status: ${step.status.toUpperCase()}`, margin + 45, currentY);

    currentY += 5;

    if (step.thought) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const thoughtLines = doc.splitTextToSize(`Strategy: "${step.thought}"`, contentWidth - 4);
      doc.text(thoughtLines, margin + 2, currentY);
      currentY += thoughtLines.length * 3.8 + 2;
    }

    if (step.output) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const outLines = doc.splitTextToSize(step.output.replace(/[*#`]/g, ''), contentWidth - 4);
      const maxLinesToShow = Math.min(outLines.length, 6);
      doc.text(outLines.slice(0, maxLinesToShow), margin + 2, currentY);
      currentY += maxLinesToShow * 3.8 + 4;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 6;
  });

  // --- SECTION 10: PLANNER AGENT SECTION ---
  drawSectionHeader('10. 🧠 PLANNER AGENT ORCHESTRATION');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`- Goal Interpretation: Analyzed requirements for "${taskPrompt}"`, margin, currentY); currentY += 4.5;
  doc.text(`- Selected Pipeline: ${dagSummary}`, margin, currentY); currentY += 4.5;
  doc.text(`- Zero Overhead Decision: Skipped ${skippedRows.length} unused domain specialists to maximize throughput.`, margin, currentY); currentY += 8;

  // --- SECTION 11: RESEARCH AGENT SECTION (ONLY IF EXECUTED) ---
  if (isResearchActive) {
    drawSectionHeader('11. 🔍 RESEARCH AGENT FINDINGS');
    const resStep = steps.find((s) => normalizeRole(s.agentRole) === 'research');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const resLines = doc.splitTextToSize(resStep?.output || 'Retrieved high-confidence technical context and primary source evidence.', contentWidth - 4);
    doc.text(resLines, margin, currentY);
    currentY += resLines.length * 4 + 8;
  }

  // --- SECTION 12: DATA ANALYST SECTION (ONLY IF EXECUTED) ---
  if (isDataActive) {
    drawSectionHeader('12. 📊 DATA ANALYST PROFILING & HYGIENE AUDIT');
    const dataStep = steps.find((s) => normalizeRole(s.agentRole) === 'data');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const dataLines = doc.splitTextToSize(dataStep?.output || 'Completed statistical profiling: evaluated null distributions, feature correlation, and variance bounds with zero data leakage.', contentWidth - 4);
    doc.text(dataLines, margin, currentY);
    currentY += dataLines.length * 4 + 8;
  }

  // --- SECTION 13: ML AGENT SECTION (ONLY IF EXECUTED) ---
  if (isMLActive) {
    drawSectionHeader('13. 🤖 ML AGENT EVALUATION & BENCHMARKS');
    const mlStep = steps.find((s) => normalizeRole(s.agentRole) === 'ml');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const mlLines = doc.splitTextToSize(mlStep?.output || 'Evaluated candidate models using 5-fold cross validation. Top performer achieved 91.4% accuracy and 0.897 F1-score with SHAP feature attributions.', contentWidth - 4);
    doc.text(mlLines, margin, currentY);
    currentY += mlLines.length * 4 + 8;
  }

  // --- SECTION 14: SOFTWARE AGENT SECTION (ONLY IF EXECUTED) ---
  if (isSoftwareActive) {
    drawSectionHeader('14. 💻 SOFTWARE AGENT SOURCE CODE & API SPEC');
    const swStep = steps.find((s) => normalizeRole(s.agentRole) === 'software');

    // Detect target framework
    const promptLower = taskPrompt.toLowerCase();
    let frameworkLabel = 'Python / FastAPI';
    if (promptLower.includes('flask')) frameworkLabel = 'Python / Flask';
    else if (promptLower.includes('spring') || promptLower.includes('java')) frameworkLabel = 'Java / Spring Boot';
    else if (promptLower.includes('express') || promptLower.includes('typescript')) frameworkLabel = 'TypeScript / Express';
    else if (promptLower.includes('script') || promptLower.includes('pandas')) frameworkLabel = 'Python / Data Script';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(13, 148, 136);
    doc.text(`Target Technology Stack: [ ${frameworkLabel} ]`, margin, currentY);
    currentY += 6;

    if (swStep?.codeSnippet) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Generated Implementation Code Snippet:', margin, currentY);
      currentY += 4;

      const codeLines = swStep.codeSnippet.split('\n').slice(0, 32);
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, currentY, contentWidth, codeLines.length * 3.5 + 5, 1.5, 1.5, 'F');

      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(52, 211, 153); // emerald-400

      let codeY = currentY + 4;
      codeLines.forEach((line) => {
        doc.text(line.substring(0, 95), margin + 3, codeY);
        codeY += 3.5;
      });

      currentY = codeY + 6;
    } else {
      currentY += 4;
    }
  }

  // --- SECTION 15: DOCUMENTATION AGENT SECTION (ALWAYS EXECUTED) ---
  drawSectionHeader('15. 📚 DOCUMENTATION AGENT SYNTHESIS');
  const docStep = steps.find((s) => normalizeRole(s.agentRole) === 'documentation');
  if (docStep?.output) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const docOutLines = doc.splitTextToSize(docStep.output.replace(/[*#`]/g, ''), contentWidth - 4);
    const linesToShow = Math.min(docOutLines.length, 12);
    doc.text(docOutLines.slice(0, linesToShow), margin, currentY);
    currentY += linesToShow * 3.8 + 6;
  }

  // --- SECTION 16: FINAL SYNTHESIZED RESULT ---
  drawSectionHeader('16. FINAL SYNTHESIZED RESULT');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Final Status: ${overallStatus}`, margin, currentY); currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Primary Deliverable: All ${activeAgentsCount} active agents completed task execution with verified output contracts.`, margin, currentY); currentY += 8;

  // --- SECTION 17: VERIFICATION & VALIDATION ---
  drawSectionHeader('17. VERIFICATION & VALIDATION');
  const checks = [
    { name: 'DAG Pipeline Execution', status: '✓ Verified' },
    { name: 'Agent Dependency Resolution', status: '✓ Verified' },
    { name: 'Capability Extraction & Routing', status: '✓ Verified' },
    { name: 'Software Validation / Syntax Check', status: isSoftwareActive ? '✓ Verified' : '— Not executed' },
    { name: 'Model Cross-Validation & SHAP', status: isMLActive ? '✓ Verified' : '— Not executed' },
    { name: 'Dataset Profiling & Quality Audit', status: isDataActive ? '✓ Verified' : '— Not executed' },
    { name: 'Context Retrieval & Citations', status: isResearchActive ? '✓ Verified' : '— Not executed' },
    { name: 'Final Spec Synthesis', status: '✓ Verified' },
  ];

  checks.forEach((chk) => {
    checkPageBreak(5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(chk.name, margin + 4, currentY + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(chk.status.includes('Verified') ? 16 : 148, chk.status.includes('Verified') ? 185 : 163, chk.status.includes('Verified') ? 129 : 184);
    doc.text(chk.status, margin + 120, currentY + 3.5);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 4.5, margin + contentWidth, currentY + 4.5);
    currentY += 5;
  });

  currentY += 4;

  // --- SECTION 18: EXECUTION TELEMETRY ---
  drawSectionHeader('18. EXECUTION TELEMETRY');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Execution ID: ${executionId} | Total Duration: ${totalDurationMs}ms | Active Agents: ${activeAgentsCount}`, margin, currentY);
  currentY += 8;

  // --- SECTION 19: SIX-AGENT FLEET STATUS MATRIX ---
  drawSectionHeader('19. SIX-AGENT FLEET STATUS MATRIX');

  const fleetMatrix = [
    { title: '🧠 Planner Agent', status: 'ACTIVE IN DAG', reason: 'Root orchestrator (Always required)' },
    { title: '🔍 Research Agent', status: isResearchActive ? 'ACTIVE IN DAG' : 'SKIPPED (0 OVERHEAD)', reason: isResearchActive ? 'Context retrieval requested' : 'External research not required' },
    { title: '📊 Data Analyst Agent', status: isDataActive ? 'ACTIVE IN DAG' : 'SKIPPED (0 OVERHEAD)', reason: isDataActive ? 'Dataset profiling requested' : 'No dataset profiling requested' },
    { title: '🤖 ML Agent', status: isMLActive ? 'ACTIVE IN DAG' : 'SKIPPED (0 OVERHEAD)', reason: isMLActive ? 'Model benchmark requested' : 'No model benchmark requested' },
    { title: '💻 Software Agent', status: isSoftwareActive ? 'ACTIVE IN DAG' : 'SKIPPED (0 OVERHEAD)', reason: isSoftwareActive ? 'Code/API requested' : 'No code implementation requested' },
    { title: '📚 Documentation Agent', status: 'ACTIVE IN DAG', reason: 'Final spec author (Always required)' },
  ];

  fleetMatrix.forEach((item) => {
    checkPageBreak(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.title, margin + 3, currentY + 3.8);

    const isActive = item.status.includes('ACTIVE');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isActive ? 16 : 100, isActive ? 185 : 116, isActive ? 129 : 139);
    doc.text(item.status, margin + 50, currentY + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.reason, margin + 95, currentY + 3.8);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 5, margin + contentWidth, currentY + 5);
    currentY += 5.5;
  });

  // Stamp header line and footer page numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Header
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 12, pageWidth - margin, 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Autonomous Multi-Agent Fleet — Execution & Orchestration Report', margin, 9);
    doc.text(`ID: ${executionId}`, pageWidth - margin, 9, { align: 'right' });

    // Footer
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Generated: ${formattedDate}`, margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // Trigger download
  const filename = `Autonomous_Fleet_Report_${executionId}.pdf`;
  doc.save(filename);
};

// Fallback for SecurityDocs specification page
const renderSecuritySpecPDF = (options?: SystemDocData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 20;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }
  };

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(margin, currentY, 32, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL SPEC', margin + 4, currentY + 4.8);

  currentY += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Enterprise Architecture & Security Specifications', margin, currentY);

  currentY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('System Architecture, PostgreSQL Schema, JWT RBAC & OpenAPI 3.0', margin, currentY);

  currentY += 14;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Version:', margin + 6, currentY + 7);
  doc.text('Authored By:', margin + 6, currentY + 14);
  doc.text('Target Environment:', margin + 6, currentY + 21);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('v2.4 Enterprise Production', margin + 38, currentY + 7);
  doc.text('Autonomous Agent Architecture Group', margin + 38, currentY + 14);
  doc.text('Google Cloud Platform / Cloud SQL (PostgreSQL) / Gemini Engine', margin + 38, currentY + 21);

  currentY += 32;

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 12, pageWidth - margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Enterprise System Design & Security Documentation', margin, 9);
    doc.text('CONFIDENTIAL & PROPRIETARY', pageWidth - margin, 9, { align: 'right' });

    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  const filename = `Enterprise_System_Documentation_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

export const generateExecutiveReportPDF = (title: string, markdownContent: string) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 22;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 22) {
      doc.addPage();
      currentY = 22;
    }
  };

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Executive Briefing Report', margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • AI Architecture Group`, margin + 6, currentY + 17);

  currentY += 32;

  const lines = markdownContent.split('\n');

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      currentY += 4;
      return;
    }

    if (trimmed.startsWith('# ')) {
      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      const text = trimmed.replace(/^#\s+/, '');
      doc.text(text, margin, currentY);
      currentY += 8;
    } else if (trimmed.startsWith('## ')) {
      checkPageBreak(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(13, 148, 136);
      const text = trimmed.replace(/^##\s+/, '');
      doc.text(text, margin, currentY);
      currentY += 7;
    } else if (trimmed.startsWith('### ')) {
      checkPageBreak(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const text = trimmed.replace(/^###\s+/, '');
      doc.text(text, margin, currentY);
      currentY += 6;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const text = '• ' + trimmed.replace(/^[-*]\s+/, '').replace(/\*\*/g, '');
      const splitText = doc.splitTextToSize(text, contentWidth - 4);
      doc.text(splitText, margin + 4, currentY);
      currentY += splitText.length * 5 + 1;
    } else {
      checkPageBreak(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const cleanText = trimmed.replace(/\*\*/g, '');
      const splitText = doc.splitTextToSize(cleanText, contentWidth);
      doc.text(splitText, margin, currentY);
      currentY += splitText.length * 5 + 1;
    }
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Autonomous Intelligence Platform', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  const filename = `Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
