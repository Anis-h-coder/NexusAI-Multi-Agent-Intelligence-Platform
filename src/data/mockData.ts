import {
  AgentState,
  DocumentFile,
  DocumentChunk,
  DatabaseTable,
  AutoMLResult,
  UserSession,
  WorkflowNode,
  WorkflowEdge
} from '../types';

export const INITIAL_AGENTS: AgentState[] = [
  {
    role: 'Planner',
    name: 'Nexus-Planner-v4',
    description: 'Understand goal intent, detect required capabilities, build dynamic DAG, select minimum specialist agents, and orchestrate execution.',
    avatar: '🧠',
    status: 'idle',
    progress: 100,
    tokenUsage: 45200,
    lastActive: 'Just now',
  },
  {
    role: 'Research',
    name: 'Nexus-Research-v2',
    description: 'Web/document research, source discovery, evidence grounding, competitor intelligence, and vector RAG retrieval.',
    avatar: '🔍',
    status: 'idle',
    progress: 100,
    tokenUsage: 89100,
    lastActive: '2 mins ago',
  },
  {
    role: 'Data Analyst',
    name: 'Nexus-Analyst-v3',
    description: 'Exploratory data analysis (EDA), dataset profiling, distribution statistics, SQL querying, and business KPI calculation.',
    avatar: '📊',
    status: 'idle',
    progress: 100,
    tokenUsage: 62400,
    lastActive: '5 mins ago',
  },
  {
    role: 'ML Agent',
    name: 'Nexus-MLE-v5',
    description: 'Candidate algorithm benchmarking, multi-model training (XGBoost/LightGBM), K-fold CV, SHAP explainability, and ML deployment.',
    avatar: '🤖',
    status: 'idle',
    progress: 100,
    tokenUsage: 112000,
    lastActive: '1 min ago',
  },
  {
    role: 'Software Agent',
    name: 'Nexus-Dev-v4',
    description: 'General-purpose software engineering specialist. Generates, modifies, tests, debugs, and validates code in any requested language & framework (Python, Java, TypeScript, Go, C#, Rust, etc.).',
    avatar: '💻',
    status: 'idle',
    progress: 100,
    tokenUsage: 94800,
    lastActive: '3 mins ago',
  },
  {
    role: 'Documentation',
    name: 'Nexus-Doc-v2',
    description: 'Authoritative technical documentation, OpenAPI specs, architecture guides, methodology explanations, and executive reports.',
    avatar: '📚',
    status: 'idle',
    progress: 100,
    tokenUsage: 31200,
    lastActive: '10 mins ago',
  },
];

export const WORKFLOW_NODES: WorkflowNode[] = [
  { id: '1', label: 'User Task Input', agentRole: 'Planner', x: 50, y: 150, status: 'completed' },
  { id: '2', label: 'Task Decomposition (DAG)', agentRole: 'Planner', x: 220, y: 150, status: 'completed' },
  { id: '3', label: 'RAG Context Retrieval', agentRole: 'Research', x: 420, y: 80, status: 'completed' },
  { id: '4', label: 'EDA & SQL Insight Synthesis', agentRole: 'Data Analyst', x: 420, y: 220, status: 'completed' },
  { id: '5', label: 'AutoML Pipeline & SHAP', agentRole: 'ML Agent', x: 640, y: 80, status: 'completed' },
  { id: '6', label: 'API Code Generation', agentRole: 'Software Agent', x: 640, y: 220, status: 'completed' },
  { id: '7', label: 'Technical OpenAPI Docs', agentRole: 'Documentation', x: 840, y: 80, status: 'completed' },
  { id: '8', label: 'Executive Report Building', agentRole: 'Report', x: 840, y: 220, status: 'completed' },
  { id: '9', label: 'Long-term Vector Memory Store', agentRole: 'Memory', x: 1040, y: 150, status: 'completed' },
];

export const WORKFLOW_EDGES: WorkflowEdge[] = [
  { id: 'e1-2', source: '1', target: '2', active: true },
  { id: 'e2-3', source: '2', target: '3', active: true },
  { id: 'e2-4', source: '2', target: '4', active: true },
  { id: 'e3-5', source: '3', target: '5', active: true },
  { id: 'e4-6', source: '4', target: '6', active: true },
  { id: 'e5-7', source: '5', target: '7', active: true },
  { id: 'e6-8', source: '6', target: '8', active: true },
  { id: 'e7-9', source: '7', target: '9', active: true },
  { id: 'e8-9', source: '8', target: '9', active: true },
];

export const SAMPLE_DOCUMENTS: DocumentFile[] = [
  {
    id: 'doc-1',
    name: 'Enterprise_Q3_Revenue_Forecast.pdf',
    size: '4.2 MB',
    type: 'pdf',
    uploadDate: '2026-07-28',
    chunkCount: 38,
    status: 'indexed',
    tokenCount: 14200,
    previewText: 'Quarterly financial report detailing Q3 expansion across enterprise Cloud and AI services...',
  },
  {
    id: 'doc-2',
    name: 'Customer_Churn_Dataset_2026.csv',
    size: '1.8 MB',
    type: 'csv',
    uploadDate: '2026-07-29',
    chunkCount: 120,
    status: 'indexed',
    tokenCount: 28400,
    previewText: 'Customer features including Tenure, Monthly Charges, Total Charges, Contract Type, and Churn status.',
  },
  {
    id: 'doc-3',
    name: 'NexusAI_Architecture_Whitepaper.pdf',
    size: '8.5 MB',
    type: 'pdf',
    uploadDate: '2026-07-25',
    chunkCount: 94,
    status: 'indexed',
    tokenCount: 41000,
    previewText: 'Technical specifications of the multi-agent orchestration layer, hybrid RAG retriever, and LangGraph DAG runner.',
  },
  {
    id: 'doc-4',
    name: 'PostgreSQL_Sales_Production_DB.sql',
    size: '560 KB',
    type: 'sql',
    uploadDate: '2026-07-30',
    chunkCount: 18,
    status: 'indexed',
    tokenCount: 6500,
    previewText: 'DDL and DML schema statements for enterprise transactions, customer telemetry, and product inventory tables.',
  },
];

export const SAMPLE_CHUNKS: DocumentChunk[] = [
  {
    id: 'chk-101',
    documentId: 'doc-1',
    documentName: 'Enterprise_Q3_Revenue_Forecast.pdf',
    content: 'Enterprise ARR grew by 34.2% YoY driven by multi-agent enterprise deployments. Gross margin held steady at 78.4% with recurring API API usage scaling to 1.2M queries per day.',
    pageOrRow: 4,
    score: 0.94,
    embeddingPreview: [0.042, -0.118, 0.892, 0.312, -0.054],
  },
  {
    id: 'chk-102',
    documentId: 'doc-2',
    documentName: 'Customer_Churn_Dataset_2026.csv',
    content: 'Feature correlation analysis indicates that Month-to-Month contracts have a 4.2x higher churn probability compared to 2-year enterprise SLA agreements.',
    pageOrRow: 1,
    score: 0.89,
    embeddingPreview: [-0.089, 0.231, 0.654, -0.112, 0.442],
  },
  {
    id: 'chk-103',
    documentId: 'doc-3',
    documentName: 'NexusAI_Architecture_Whitepaper.pdf',
    content: 'The Planner Agent employs dynamic beam search over execution subgraphs to guarantee non-cyclic execution with max step timeouts.',
    pageOrRow: 12,
    score: 0.86,
    embeddingPreview: [0.124, 0.441, -0.021, 0.771, 0.098],
  },
];

export const SAMPLE_AUTOML_RESULTS: AutoMLResult = {
  datasetName: 'Customer_Churn_Dataset_2026.csv',
  problemType: 'classification',
  rowCount: 7043,
  columnCount: 21,
  missingValuesCleaned: 11,
  featuresEncoded: 8,
  models: [
    { modelName: 'XGBoost Classifier', accuracy: 0.912, f1Score: 0.894, precision: 0.905, recall: 0.884, trainingTimeSec: 2.4, isBest: true },
    { modelName: 'LightGBM Classifier', accuracy: 0.898, f1Score: 0.879, precision: 0.891, recall: 0.868, trainingTimeSec: 1.8, isBest: false },
    { modelName: 'Random Forest', accuracy: 0.875, f1Score: 0.852, precision: 0.864, recall: 0.841, trainingTimeSec: 3.1, isBest: false },
    { modelName: 'Logistic Regression', accuracy: 0.804, f1Score: 0.778, precision: 0.790, recall: 0.767, trainingTimeSec: 0.4, isBest: false },
  ],
  bestModel: 'XGBoost Classifier',
  shapValues: [
    { feature: 'Contract_MonthToMonth', importance: 0.385, impactDirection: 'positive' },
    { feature: 'Tenure_Months', importance: 0.264, impactDirection: 'negative' },
    { feature: 'MonthlyCharges', importance: 0.182, impactDirection: 'positive' },
    { feature: 'InternetService_Fiber', importance: 0.115, impactDirection: 'positive' },
    { feature: 'TechSupport_No', importance: 0.054, impactDirection: 'positive' },
  ],
  confusionMatrix: {
    labels: ['Retained', 'Churned'],
    matrix: [
      [4650, 524],
      [362, 1507],
    ],
  },
  anomalyData: Array.from({ length: 30 }, (_, i) => ({
    index: i + 1,
    timestamp: `2026-07-${(i + 1).toString().padStart(2, '0')}`,
    metricValue: Math.round(150 + Math.random() * 80 + (i === 14 || i === 22 ? 220 : 0)),
    anomalyScore: i === 14 || i === 22 ? 0.94 : Math.round(Math.random() * 0.3 * 100) / 100,
    isAnomaly: i === 14 || i === 22,
  })),
  forecastData: Array.from({ length: 14 }, (_, i) => {
    const base = 500 + i * 25;
    return {
      date: `2026-08-${(i + 1).toString().padStart(2, '0')}`,
      actual: i < 7 ? base + (Math.random() * 40 - 20) : undefined,
      forecast: base,
      upperBound: base + 45,
      lowerBound: base - 45,
    };
  }),
  pythonCode: `import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import classification_report, roc_auc_score
import shap

# 1. Load Data
df = pd.read_csv('Customer_Churn_Dataset_2026.csv')

# 2. Automated Preprocessing & Cleaning
df['TotalCharges'] = pd.to_numeric(df['TotalCharges'], errors='coerce')
df['TotalCharges'].fillna(df['TotalCharges'].median(), inplace=True)

# 3. Encoding & Feature Engineering
categorical_cols = df.select_dtypes(include=['object']).columns.drop('customerID', errors='ignore')
df_encoded = pd.get_dummies(df, columns=categorical_cols, drop_first=True)

X = df_encoded.drop(columns=['Churn_Yes', 'customerID'], errors='ignore')
y = df_encoded['Churn_Yes']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# 4. Model Training (XGBoost)
model = XGBClassifier(n_estimators=150, learning_rate=0.05, max_depth=5, subsample=0.8, eval_metric='logloss')
model.fit(X_train, y_train)

# 5. Model Evaluation & SHAP Explainability
preds = model.predict(X_test)
print(classification_report(y_test, preds))

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test)`,
};

export const SAMPLE_DATABASE_TABLES: DatabaseTable[] = [
  {
    tableName: 'customers',
    friendlyName: 'Customer Directory',
    description: 'Customer profiles, country of residence, membership tier, and total spending history.',
    rowCount: 1420,
    columns: [
      { name: 'customer_id', type: 'UUID', isPrimaryKey: true, friendlyName: 'Customer ID', typeLabel: 'ID', description: 'Unique customer identifier' },
      { name: 'full_name', type: 'VARCHAR(150)', friendlyName: 'Full Name', typeLabel: 'Text', description: 'Customer full name' },
      { name: 'country', type: 'VARCHAR(80)', friendlyName: 'Country', typeLabel: 'Text', description: 'Country of residence' },
      { name: 'membership_tier', type: 'VARCHAR(50)', friendlyName: 'Membership Tier', typeLabel: 'Badge', description: 'Tier (VIP, Gold, Silver, Standard)' },
      { name: 'total_spend_usd', type: 'DECIMAL(10,2)', friendlyName: 'Total Spend ($)', typeLabel: 'Money', description: 'Lifetime purchase amount in USD' },
      { name: 'signup_date', type: 'DATE', friendlyName: 'Signup Date', typeLabel: 'Date', description: 'Account registration date' },
    ],
    sampleRows: [
      { customer_id: 'cust-101', full_name: 'Emma Watson', country: 'United States', membership_tier: 'VIP', total_spend_usd: 4850.00, signup_date: '2024-02-15' },
      { customer_id: 'cust-102', full_name: 'Liam Smith', country: 'Canada', membership_tier: 'Gold', total_spend_usd: 2190.50, signup_date: '2024-05-10' },
      { customer_id: 'cust-103', full_name: 'Sophia Chen', country: 'United Kingdom', membership_tier: 'Silver', total_spend_usd: 890.00, signup_date: '2025-01-20' },
      { customer_id: 'cust-104', full_name: 'Noah Garcia', country: 'Australia', membership_tier: 'VIP', total_spend_usd: 6400.25, signup_date: '2023-11-04' },
      { customer_id: 'cust-105', full_name: 'Olivia Martinez', country: 'Germany', membership_tier: 'Gold', total_spend_usd: 3120.00, signup_date: '2024-08-19' },
    ],
  },
  {
    tableName: 'store_orders',
    friendlyName: 'E-Commerce Orders',
    description: 'Retail customer order records, purchased products, quantities, and delivery statuses.',
    rowCount: 5840,
    columns: [
      { name: 'order_id', type: 'VARCHAR(30)', isPrimaryKey: true, friendlyName: 'Order ID', typeLabel: 'ID', description: 'Unique order reference number' },
      { name: 'customer_name', type: 'VARCHAR(150)', friendlyName: 'Customer Name', typeLabel: 'Text', description: 'Name of the buyer' },
      { name: 'product_title', type: 'VARCHAR(200)', friendlyName: 'Product Purchased', typeLabel: 'Text', description: 'Item title' },
      { name: 'quantity', type: 'INTEGER', friendlyName: 'Quantity', typeLabel: 'Number', description: 'Units ordered' },
      { name: 'total_price', type: 'DECIMAL(10,2)', friendlyName: 'Order Total ($)', typeLabel: 'Money', description: 'Total charge in USD' },
      { name: 'order_status', type: 'VARCHAR(30)', friendlyName: 'Order Status', typeLabel: 'Status', description: 'Fulfillment status (Delivered, Shipped, Processing)' },
    ],
    sampleRows: [
      { order_id: 'ORD-9021', customer_name: 'Emma Watson', product_title: 'Noise-Canceling Headphones', quantity: 1, total_price: 249.99, order_status: 'Delivered' },
      { order_id: 'ORD-9022', customer_name: 'Liam Smith', product_title: 'Ergonomic Standing Desk', quantity: 1, total_price: 499.00, order_status: 'Shipped' },
      { order_id: 'ORD-9023', customer_name: 'Sophia Chen', product_title: 'Mechanical RGB Keyboard', quantity: 2, total_price: 259.00, order_status: 'Delivered' },
      { order_id: 'ORD-9024', customer_name: 'Noah Garcia', product_title: 'UltraHD 4K Monitor 32"', quantity: 1, total_price: 549.50, order_status: 'Processing' },
      { order_id: 'ORD-9025', customer_name: 'Olivia Martinez', product_title: 'Smart Fitness Watch', quantity: 1, total_price: 199.00, order_status: 'Delivered' },
    ],
  },
  {
    tableName: 'products_catalog',
    friendlyName: 'Product Inventory',
    description: 'Store merchandise catalog with categories, retail prices, available stock, and ratings.',
    rowCount: 320,
    columns: [
      { name: 'sku_code', type: 'VARCHAR(50)', isPrimaryKey: true, friendlyName: 'SKU Code', typeLabel: 'ID', description: 'Stock keeping unit identifier' },
      { name: 'product_name', type: 'VARCHAR(200)', friendlyName: 'Product Name', typeLabel: 'Text', description: 'Commercial product title' },
      { name: 'category', type: 'VARCHAR(80)', friendlyName: 'Category', typeLabel: 'Text', description: 'Product category (Electronics, Furniture, Apparel)' },
      { name: 'unit_price', type: 'DECIMAL(8,2)', friendlyName: 'Unit Price ($)', typeLabel: 'Money', description: 'Retail price per unit' },
      { name: 'stock_quantity', type: 'INTEGER', friendlyName: 'Stock Level', typeLabel: 'Number', description: 'Available units in warehouse' },
      { name: 'rating', type: 'DECIMAL(3,2)', friendlyName: 'Customer Rating', typeLabel: 'Rating', description: 'Average star rating (1.0 to 5.0)' },
    ],
    sampleRows: [
      { sku_code: 'SKU-1001', product_name: 'Noise-Canceling Headphones', category: 'Electronics', unit_price: 249.99, stock_quantity: 142, rating: 4.8 },
      { sku_code: 'SKU-1002', product_name: 'Ergonomic Standing Desk', category: 'Furniture', unit_price: 499.00, stock_quantity: 38, rating: 4.7 },
      { sku_code: 'SKU-1003', product_name: 'Mechanical RGB Keyboard', category: 'Electronics', unit_price: 129.50, stock_quantity: 95, rating: 4.6 },
      { sku_code: 'SKU-1004', product_name: 'Organic Cotton Hoodie', category: 'Apparel', unit_price: 65.00, stock_quantity: 210, rating: 4.5 },
      { sku_code: 'SKU-1005', product_name: 'Smart Fitness Watch', category: 'Electronics', unit_price: 199.00, stock_quantity: 84, rating: 4.9 },
    ],
  },
  {
    tableName: 'employee_directory',
    friendlyName: 'Employee HR Directory',
    description: 'Company staff list with department assignments, job titles, annual salaries, and hire dates.',
    rowCount: 450,
    columns: [
      { name: 'employee_id', type: 'VARCHAR(30)', isPrimaryKey: true, friendlyName: 'Employee ID', typeLabel: 'ID', description: 'Unique staff identification code' },
      { name: 'full_name', type: 'VARCHAR(150)', friendlyName: 'Employee Name', typeLabel: 'Text', description: 'Staff full name' },
      { name: 'department', type: 'VARCHAR(80)', friendlyName: 'Department', typeLabel: 'Text', description: 'Department (Engineering, Marketing, Sales, HR)' },
      { name: 'job_title', type: 'VARCHAR(120)', friendlyName: 'Job Title', typeLabel: 'Text', description: 'Designated role' },
      { name: 'salary_usd', type: 'DECIMAL(10,2)', friendlyName: 'Annual Salary ($)', typeLabel: 'Money', description: 'Base salary in USD' },
      { name: 'hire_date', type: 'DATE', friendlyName: 'Hire Date', typeLabel: 'Date', description: 'Employment start date' },
    ],
    sampleRows: [
      { employee_id: 'EMP-401', full_name: 'Marcus Vance', department: 'Engineering', job_title: 'Senior Software Engineer', salary_usd: 145000.00, hire_date: '2022-03-15' },
      { employee_id: 'EMP-402', full_name: 'Elena Rostova', department: 'Marketing', job_title: 'Growth Marketing Lead', salary_usd: 98000.00, hire_date: '2023-06-01' },
      { employee_id: 'EMP-403', full_name: 'David Kim', department: 'Sales', job_title: 'Account Executive', salary_usd: 112000.00, hire_date: '2021-11-10' },
      { employee_id: 'EMP-404', full_name: 'Sarah Connor', department: 'HR', job_title: 'People Operations Lead', salary_usd: 88000.00, hire_date: '2024-01-08' },
      { employee_id: 'EMP-405', full_name: 'James Wilson', department: 'Engineering', job_title: 'DevOps Specialist', salary_usd: 132000.00, hire_date: '2023-09-20' },
    ],
  },
  {
    tableName: 'property_listings',
    friendlyName: 'Real Estate Listings',
    description: 'Residential property listings including location, bedrooms, square footage, listing price, and status.',
    rowCount: 1250,
    columns: [
      { name: 'property_id', type: 'VARCHAR(30)', isPrimaryKey: true, friendlyName: 'Property ID', typeLabel: 'ID', description: 'Property listing ID' },
      { name: 'address', type: 'VARCHAR(200)', friendlyName: 'Street Address', typeLabel: 'Text', description: 'Property address' },
      { name: 'city', type: 'VARCHAR(80)', friendlyName: 'City', typeLabel: 'Text', description: 'City location' },
      { name: 'bedrooms', type: 'INTEGER', friendlyName: 'Bedrooms', typeLabel: 'Number', description: 'Bedroom count' },
      { name: 'sqft', type: 'INTEGER', friendlyName: 'Square Feet', typeLabel: 'Number', description: 'Interior area size' },
      { name: 'price_usd', type: 'DECIMAL(12,2)', friendlyName: 'Listing Price ($)', typeLabel: 'Money', description: 'Property asking price' },
      { name: 'status', type: 'VARCHAR(30)', friendlyName: 'Status', typeLabel: 'Status', description: 'Listing status (Active, Pending, Sold)' },
    ],
    sampleRows: [
      { property_id: 'PROP-801', address: '742 Evergreen Terrace', city: 'Springfield', bedrooms: 4, sqft: 2450, price_usd: 485000.00, status: 'Active' },
      { property_id: 'PROP-802', address: '108 Ocean Drive', city: 'Miami', bedrooms: 5, sqft: 3800, price_usd: 1250000.00, status: 'Pending' },
      { property_id: 'PROP-803', address: '42 Pine Street', city: 'Seattle', bedrooms: 3, sqft: 1850, price_usd: 620000.00, status: 'Active' },
      { property_id: 'PROP-804', address: '15 Maple Avenue', city: 'Austin', bedrooms: 3, sqft: 2100, price_usd: 540000.00, status: 'Sold' },
      { property_id: 'PROP-805', address: '89 Sunset Boulevard', city: 'Los Angeles', bedrooms: 4, sqft: 2900, price_usd: 980000.00, status: 'Active' },
    ],
  },
  {
    tableName: 'ad_campaigns',
    friendlyName: 'Marketing Campaigns',
    description: 'Digital advertising campaign performance, ad spend, clicks, conversions, and revenue generated.',
    rowCount: 280,
    columns: [
      { name: 'campaign_id', type: 'VARCHAR(30)', isPrimaryKey: true, friendlyName: 'Campaign ID', typeLabel: 'ID', description: 'Ad campaign code' },
      { name: 'campaign_name', type: 'VARCHAR(200)', friendlyName: 'Campaign Title', typeLabel: 'Text', description: 'Ad campaign name' },
      { name: 'platform', type: 'VARCHAR(50)', friendlyName: 'Channel', typeLabel: 'Text', description: 'Platform (Meta, Google Ads, TikTok, LinkedIn)' },
      { name: 'budget_spent', type: 'DECIMAL(10,2)', friendlyName: 'Ad Spend ($)', typeLabel: 'Money', description: 'Total budget spent in USD' },
      { name: 'clicks', type: 'INTEGER', friendlyName: 'Total Clicks', typeLabel: 'Number', description: 'Total click count' },
      { name: 'conversions', type: 'INTEGER', friendlyName: 'Conversions', typeLabel: 'Number', description: 'Completed purchase actions' },
      { name: 'revenue_generated', type: 'DECIMAL(10,2)', friendlyName: 'Revenue ($)', typeLabel: 'Money', description: 'Sales revenue generated' },
    ],
    sampleRows: [
      { campaign_id: 'CAMP-301', campaign_name: 'Summer Flash Sale 2026', platform: 'Meta Ads', budget_spent: 4500.00, clicks: 14200, conversions: 620, revenue_generated: 28400.00 },
      { campaign_id: 'CAMP-302', campaign_name: 'Brand Search Retargeting', platform: 'Google Ads', budget_spent: 8200.00, clicks: 28900, conversions: 1140, revenue_generated: 64500.00 },
      { campaign_id: 'CAMP-303', campaign_name: 'New Product Launch Video', platform: 'TikTok Ads', budget_spent: 3100.00, clicks: 18500, conversions: 340, revenue_generated: 14200.00 },
      { campaign_id: 'CAMP-304', campaign_name: 'B2B Executive Outreach', platform: 'LinkedIn', budget_spent: 6000.00, clicks: 4200, conversions: 180, revenue_generated: 32000.00 },
    ],
  },
];

export const CURRENT_USER: UserSession = {
  username: 'alex.vanguard',
  email: 'fanish050@gmail.com',
  role: 'AI Architect',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYW5pc2gwNTAiLCJyb2xlIjoiQUkgQXJjaGl0ZWN0IiwiaWF0IjoxNzU0MTU4OTk2fQ.nexus-sig-884920412',
  expiresIn: '23h 59m',
  permissions: ['agents:execute', 'automl:train', 'rag:manage', 'sql:query', 'reports:generate', 'admin:access'],
};

