require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs for AI endpoints
  message: { error: 'Too many AI requests from this IP, please try again after 15 minutes.' }
});

const app = express();
app.set('trust proxy', true); // Trust IIS ARR / reverse proxy headers

app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for simplicity in this visualizer
  frameguard: false            // Allow embedding inside VS Code Webviews
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// --- Hard-to-Guess Static Authentication Accounts ---
const STATIC_USERS = [
  { username: 'sys_ops9x', password: 'K9#vP$8xL2!zQ1', role: 'System Administrator', name: 'Ops Admin' },
  { username: 'arch_lead4', password: 'W4*mE#9tR7@yU3', role: 'Lead Architect', name: 'Lead Architect' },
  { username: 'data_core7', password: 'J7$nB&2hF5!pX8', role: 'Data Engineer', name: 'Data Engineer' },
  { username: 'qa_audit2', password: 'T3#kM%6wS9*vC4', role: 'QA Auditor', name: 'QA Auditor' },
  { username: 'inspect_x8', password: 'R8@zY^5qD1!mN7', role: 'Security Inspector', name: 'Inspector' }
];

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required in production mode.');
  process.exit(1);
}

// Helpers for robust auth & connection token extraction (supports both Cookies & Headers)
function getToken(req) {
  return req.cookies?.auth_token || 
         req.headers?.authorization?.replace(/^Bearer\s+/i, '') || 
         req.headers?.['x-auth-token'];
}

function getCid(req) {
  return req.cookies?.db_connection_id || 
         req.headers?.['x-db-connection-id'] || 
         req.query?.cid;
}

// --- Auth Routes ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Find matching user from the 5 hard-to-guess static accounts
  const matchedUser = STATIC_USERS.find(
    u => u.username.toLowerCase() === (username || '').trim().toLowerCase() && 
         u.password === password
  );

  if (matchedUser) {
    const userPayload = {
      username: matchedUser.username,
      role: matchedUser.role,
      name: matchedUser.name
    };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { 
      httpOnly: true, 
      sameSite: 'lax',
      path: '/'
    });
    res.json({ success: true, token, user: userPayload });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.clearCookie('db_connection_id');
  res.json({ success: true });
});

app.get('/api/auth-status', (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ authenticated: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ 
      authenticated: true, 
      user: {
        username: decoded.username,
        role: decoded.role || 'User',
        name: decoded.name || decoded.username
      }
    });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

// --- Auth Middleware ---
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: Please sign in' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Session expired, please sign in again' });
  }
}

// Apply auth middleware to all subsequent API routes
app.use('/api', requireAuth);

// Check connection status
app.get('/api/status', async (req, res) => {
  const cid = getCid(req);
  const config = cid ? db.getConfig(cid) : null;
  const currentDb = cid ? await db.getCurrentDatabase(cid) : null;
  res.json({ 
    connected: !!config,
    cid,
    currentDatabase: currentDb || (config ? (config.database || 'master') : null)
  });
});

// Connect
app.post('/api/connect', async (req, res) => {
  try {
    const config = req.body;
    // Extract existing ID if they are re-connecting/re-verifying in the same browser session
    const existingCid = getCid(req);
    const cid = await db.connect(config, existingCid);
    
    // Use the new/existing cid to fetch databases
    const databases = await db.listDatabases(cid);
    let currentDb = await db.getCurrentDatabase(cid);

    // If user specified a database, ensure we switch to it
    if (config.database && currentDb !== config.database) {
      await db.switchDatabase(cid, config.database);
      currentDb = await db.getCurrentDatabase(cid);
    } 
    
    // Fallback: If we ended up on a database that isn't in our user databases list (like master),
    // automatically switch to the first available user database.
    if (databases.length > 0 && !databases.includes(currentDb)) {
      await db.switchDatabase(cid, databases[0]);
      currentDb = await db.getCurrentDatabase(cid);
    }
    
    // Set cookie that lives for the session
    res.cookie('db_connection_id', cid, { 
      httpOnly: true, 
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({ 
      success: true, 
      cid,
      databases, 
      currentDatabase: currentDb || config.database || (databases[0] || 'master') 
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Connection failed' });
  }
});

// Disconnect
app.post('/api/disconnect', async (req, res) => {
  try {
    const cid = getCid(req);
    if (cid) await db.disconnect(cid);
    res.clearCookie('db_connection_id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Databases
app.get('/api/databases', async (req, res) => {
  try {
    const databases = await db.listDatabases(getCid(req));
    res.json({ databases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Switch Database
app.post('/api/switch-database', async (req, res) => {
  try {
    const { database } = req.body;
    if (!database) throw new Error('Database name required');
    const cid = getCid(req);
    if (!cid) throw new Error('No active connection session');

    await db.switchDatabase(cid, database);
    const schema = await db.getSchema(cid);
    const actualDb = await db.getCurrentDatabase(cid);
    
    res.json({ success: true, schema, currentDatabase: actualDb || database });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Schema
app.get('/api/schema', async (req, res) => {
  try {
    const schema = await db.getSchema(getCid(req));
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Full Schema for Comparison
app.get('/api/database/:dbName/full-schema', async (req, res) => {
  try {
    const { dbName } = req.params;
    const fullSchema = await db.getFullSchemaForDatabase(getCid(req), dbName);
    res.json(fullSchema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Table Data
app.get('/api/table/:schema/:name/data', async (req, res) => {
  try {
    const { schema, name } = req.params;
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 50;
    
    const data = await db.getTableData(getCid(req), schema, name, page, size);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Table Count
app.get('/api/table/:schema/:name/count', async (req, res) => {
  try {
    const { schema, name } = req.params;
    const count = await db.getTableCount(getCid(req), schema, name);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get table dependencies
app.get('/api/tables/:schema/:name/dependencies', async (req, res) => {
  try {
    const { schema, name } = req.params;
    const deps = await db.getTableDependencies(getCid(req), schema, name);
    res.json(deps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Stored Procedures
app.get('/api/sps', async (req, res) => {
  try {
    const sps = await db.getStoredProcedures(getCid(req));
    res.json(sps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze Stored Procedure
app.get('/api/sps/:schema/:name/analyze', async (req, res) => {
  try {
    const { schema, name } = req.params;
    const analysis = await db.analyzeStoredProcedure(getCid(req), schema, name);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get SP Definition (Current DB)
app.get('/api/sps/:schema/:name/definition', async (req, res) => {
  try {
    const { schema, name } = req.params;
    const definition = await db.getSpDefinition(getCid(req), schema, name);
    res.json({ definition });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get SP Definition (Target DB)
app.get('/api/database/:dbName/sps/:schema/:name/definition', async (req, res) => {
  try {
    const { dbName, schema, name } = req.params;
    const definition = await db.getSpDefinitionForDatabase(getCid(req), dbName, schema, name);
    res.json({ definition });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Enhanced Comparison Endpoints (Dual Connection / Remote Servers) ---

// Test remote target connection & list databases
app.post('/api/compare/target-databases', async (req, res) => {
  try {
    const { targetConfig } = req.body;
    if (!targetConfig) {
      return res.status(400).json({ error: 'Target connection configuration is required' });
    }
    const result = await db.listDatabasesFromConfig(targetConfig);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to connect to target database server' });
  }
});

// Get full schema & SPs for comparison (supports same-server or remote server configuration)
app.post('/api/compare/full-schema', async (req, res) => {
  try {
    const { sameServer, dbName, targetConfig } = req.body;

    if (sameServer || !targetConfig) {
      if (!dbName) throw new Error('Database name required for comparison');
      const cid = getCid(req);
      if (!cid) throw new Error('No active connection session');
      const fullSchema = await db.getFullSchemaForDatabase(cid, dbName);
      return res.json({ ...fullSchema, currentDatabase: dbName });
    }

    // Remote server configuration
    const fullSchema = await db.getFullSchemaFromConfig(targetConfig, dbName);
    res.json(fullSchema);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch schema for comparison' });
  }
});

// Get SP definition for comparison (supports same-server or remote server configuration)
app.post('/api/compare/sp-definition', async (req, res) => {
  try {
    const { sameServer, dbName, targetConfig, schema, name } = req.body;
    if (!schema || !name) throw new Error('Schema and SP name required');

    if (sameServer || !targetConfig) {
      const cid = getCid(req);
      if (!cid) throw new Error('No active connection session');
      const definition = dbName 
        ? await db.getSpDefinitionForDatabase(cid, dbName, schema, name)
        : await db.getSpDefinition(cid, schema, name);
      return res.json({ definition });
    }

    const definition = await db.getSpDefinitionFromConfig(targetConfig, schema, name, dbName);
    res.json({ definition });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch SP definition' });
  }
});

// --- SQL Safety Scanner ---
const DANGEROUS_SQL_PATTERNS = [
  /\b(ALTER)\s+(TABLE|PROCEDURE|FUNCTION|VIEW|INDEX|DATABASE|SCHEMA|TRIGGER)\b/gi,
  /\b(DROP)\s+(TABLE|PROCEDURE|FUNCTION|VIEW|INDEX|DATABASE|SCHEMA|TRIGGER)\b/gi,
  /\b(DELETE)\s+(FROM)\b/gi,
  /\b(TRUNCATE)\s+(TABLE)\b/gi,
  /\b(INSERT)\s+(INTO)\b/gi,
  /\b(UPDATE)\s+\[?\w+\]?\s+SET\b/gi,
  /\b(CREATE)\s+(TABLE|PROCEDURE|FUNCTION|VIEW|INDEX|DATABASE|SCHEMA|TRIGGER)\b/gi,
  /\b(GRANT|REVOKE)\s+/gi,
  /\b(EXEC|EXECUTE)\s+/gi,
  /\b(MERGE)\s+/gi,
  /\b(DISABLE|ENABLE)\s+TRIGGER\b/gi,
];

function scanForDangerousSQL(text) {
  const warnings = [];
  // Only scan inside code blocks (``` ... ```)
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = text.match(codeBlockRegex) || [];

  for (const block of codeBlocks) {
    for (const pattern of DANGEROUS_SQL_PATTERNS) {
      pattern.lastIndex = 0; // reset regex state
      const match = pattern.exec(block);
      if (match) {
        warnings.push(`Detected potentially dangerous SQL statement: "${match[0].trim()}". This is a READ-ONLY tool — do not execute modification statements.`);
      }
    }
  }

  // Deduplicate warnings
  return [...new Set(warnings)];
}

// --- Read-Only Constraint for General Chat ---
const READ_ONLY_CHAT_CONSTRAINT = `

CRITICAL SAFETY RULE: You are operating inside a READ-ONLY database visualization tool.
- You must NEVER generate, suggest, or include any SQL that modifies data or schema.
- FORBIDDEN statements: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, EXECUTE, GRANT, REVOKE, MERGE.
- You must NEVER suggest running or executing any stored procedure.
- You may ONLY use SELECT statements in examples for analysis purposes.
- If asked to modify anything, refuse and explain that this is a read-only analysis tool.`;

// --- 360° SP Overview System Prompt (Server-Side, Hardcoded) ---
const SP_OVERVIEW_SYSTEM_PROMPT = `You are an expert SQL Server database analyst integrated into a read-only database visualization tool.

## YOUR ROLE
You analyze stored procedures and provide comprehensive 360° overviews. You are a READ-ONLY analyst.

## CRITICAL SAFETY RULES
1. You must NEVER generate, suggest, or include any SQL that modifies data or schema.
2. FORBIDDEN statements: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, EXECUTE, GRANT, REVOKE, MERGE, DISABLE, ENABLE.
3. You must NEVER suggest running or executing any stored procedure.
4. You must NEVER provide modified versions of the stored procedure code.
5. If the user asks you to modify anything, you must refuse and explain that you are a read-only analysis tool.
6. You may ONLY use SELECT statements in examples, and only to illustrate how to query for analysis.

## OUTPUT FORMAT
Analyze the stored procedure and produce a report with these sections:

### 🎯 Purpose & Summary
A plain-English explanation of what this SP does, who would call it, and when.

### 📥 Input Parameters
A table of all parameters with: Name, Type, Default, Required/Optional, and a description of what each controls.

### 📤 Output Schema
What this SP returns — columns, types, and what they represent.

### 🗂️ Table Impact Map
List every table referenced and classify the operation:
- 📖 READ (SELECT/JOIN)
- ✏️ WRITE (INSERT/UPDATE/DELETE)
- 📋 AUDIT (logging/tracking)
Mark each clearly. This is critical for understanding blast radius.

### 🔗 Dependency Chain
- **Depends On**: Tables, views, functions, other SPs this procedure calls
- **Referenced By**: Other objects that call this procedure

### 🔄 Data Flow
Describe how data flows through the SP: what gets joined, filtered, transformed, and returned.

### 🔒 Security & Audit Analysis
- Does it use dynamic SQL? (potential injection risk)
- Does it implement audit logging?
- Are there any hardcoded database names? (portability concern)
- Does it use TRY/CATCH for error handling?

### ⚡ Performance Observations
- Are there potential missing indexes?
- Any use of scalar functions in SELECT (performance anti-pattern)?
- Cursor usage?
- Large temp table operations?
- Any N+1 query patterns?

### 💥 Change Impact Assessment
If someone modifies the underlying tables (e.g., adds/removes columns), what in this SP would break? List specific lines/sections at risk.`;

// AI Chat Proxy (OpenRouter) — with read-only constraint injected
app.post('/api/ai/chat', aiLimiter, async (req, res) => {
  try {
    const { messages, model, apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'OpenRouter API Key is required.' });
    }

    // Inject read-only constraint into the first system message (if present)
    const safeMessages = messages.map((msg, i) => {
      if (i === 0 && msg.role === 'system') {
        return { ...msg, content: msg.content + READ_ONLY_CHAT_CONSTRAINT };
      }
      return msg;
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DB Visualizer',
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: safeMessages
      })
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`OpenRouter returned invalid JSON (Status: ${response.status}). Body: ${text.substring(0, 100)}...`);
    }
    
    if (!response.ok) {
      throw new Error(data.error?.message || `Failed to fetch from OpenRouter (Status: ${response.status})`);
    }

    // Scan AI response for dangerous SQL
    const aiContent = data.choices?.[0]?.message?.content || '';
    const warnings = scanForDangerousSQL(aiContent);
    if (warnings.length > 0) {
      data._safety_warnings = warnings;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 360° SP Overview — Server-side hardcoded prompt, client cannot modify safety instructions
app.post('/api/ai/analyze-sp', aiLimiter, async (req, res) => {
  try {
    const { spMetadata, model, apiKey } = req.body;

    if (!apiKey) {
      return res.status(401).json({ error: 'OpenRouter API Key is required.' });
    }

    if (!spMetadata || !spMetadata.definition) {
      return res.status(400).json({ error: 'SP metadata with definition is required.' });
    }

    // Build the user message from SP metadata — this is the ONLY client-controlled content
    let userContent = `Analyze this stored procedure:\n\n`;
    userContent += `**Name:** ${spMetadata.schema}.${spMetadata.name}\n\n`;
    userContent += `**Definition:**\n\`\`\`sql\n${spMetadata.definition}\n\`\`\`\n\n`;

    if (spMetadata.parameters && spMetadata.parameters.length > 0) {
      userContent += `**Parameters:**\n`;
      spMetadata.parameters.forEach(p => {
        userContent += `- ${p.ParameterName} (${p.DataType}${p.MaxLength === -1 ? '(max)' : p.MaxLength > 0 ? `(${p.MaxLength})` : ''}) ${p.IsOutput ? '[OUTPUT]' : '[INPUT]'}\n`;
      });
      userContent += '\n';
    }

    if (spMetadata.outputColumns && spMetadata.outputColumns.length > 0) {
      userContent += `**Predicted Output Columns:**\n`;
      spMetadata.outputColumns.forEach(c => {
        userContent += `- ${c.name} (${c.system_type_name}) ${c.is_nullable ? 'NULLABLE' : 'NOT NULL'}\n`;
      });
      userContent += '\n';
    }

    if (spMetadata.dependsOn && spMetadata.dependsOn.length > 0) {
      userContent += `**Depends On:**\n`;
      spMetadata.dependsOn.forEach(d => {
        userContent += `- ${d.schema_name}.${d.entity_name} (${d.type})\n`;
      });
      userContent += '\n';
    }

    if (spMetadata.referencedBy && spMetadata.referencedBy.length > 0) {
      userContent += `**Referenced By:**\n`;
      spMetadata.referencedBy.forEach(d => {
        userContent += `- ${d.schema_name}.${d.entity_name} (${d.type})\n`;
      });
      userContent += '\n';
    }

    // System prompt is HARDCODED — client cannot modify safety rules
    const apiMessages = [
      { role: 'system', content: SP_OVERVIEW_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DB Visualizer - SP Analyzer',
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: apiMessages
      })
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`OpenRouter returned invalid JSON (Status: ${response.status}). Body: ${text.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(data.error?.message || `Failed to fetch from OpenRouter (Status: ${response.status})`);
    }

    // Layer 2: Scan the AI response for dangerous SQL
    const aiContent = data.choices?.[0]?.message?.content || '';
    const warnings = scanForDangerousSQL(aiContent);

    res.json({
      content: aiContent,
      warnings: warnings,
      model: data.model,
      usage: data.usage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Deployment: Serve Static Frontend ---
const possibleDistPaths = [
  path.join(__dirname, '../client/dist'),
  path.join(__dirname, './client/dist'),
  path.join(__dirname, './dist'),
  path.join(__dirname, './public')
];
const distPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || possibleDistPaths[0];
const indexPath = path.join(distPath, 'index.html');

console.log(`[Deployment] Serving static frontend from: ${distPath}`);

app.use(express.static(distPath));

// Unmatched API route handler (prevent returning index.html for failed API calls)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// SPA fallback for frontend routes
app.use((req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend bundle not found. Please build the client using "npm run build".');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
