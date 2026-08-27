import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Send, Settings, MessageSquare, Loader2, Database, AlertCircle, 
  Sparkles, Bot, User, Check, Copy, ArrowRight, Search, Zap, HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { schemaToMarkdown } from '../utils/schemaToMarkdown';

const DEFAULT_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast & Recommended)', isFree: false },
  { id: 'openai/gpt-4o', name: 'GPT-4o (High Intelligence)', isFree: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Architecture & SQL)', isFree: false },
  { id: 'deepseek/deepseek-r1:free', name: '[Free] DeepSeek R1 (Reasoning)', isFree: true },
  { id: 'google/gemini-2.0-flash-exp:free', name: '[Free] Gemini 2.0 Flash', isFree: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: '[Free] Llama 3.3 70B', isFree: true },
  { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: '[Free] Mistral Small 24B', isFree: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', isFree: false },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', isFree: false }
];

export default function AiChat({ 
  isOpen, 
  onClose, 
  currentDatabase,
  schemaData, 
  spsData, 
  selectedSp, 
  selectedTable, 
  initialMessage, 
  onInitialMessageConsumed,
  isDetailOpen,
  detailWidth = '400px'
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('openai/gpt-4o-mini');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSpDetails, setSelectedSpDetails] = useState(null);
  const [selectedTableDeps, setSelectedTableDeps] = useState(null);
  
  const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const messagesEndRef = useRef(null);

  // Load settings from local storage
  useEffect(() => {
    const savedKey = localStorage.getItem('openrouter_key');
    const savedModel = localStorage.getItem('openrouter_model');
    if (savedKey) {
      setApiKey(savedKey);
      setShowSettings(false);
    } else {
      setShowSettings(true);
    }
    if (savedModel) setModel(savedModel);
  }, []);

  // Fetch available models from OpenRouter
  useEffect(() => {
    if (showSettings) {
      setIsLoadingModels(true);
      fetch('https://openrouter.ai/api/v1/models')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.data) && data.data.length > 0) {
            const fetchedModels = data.data.map(m => {
              const isFree = (m.pricing?.prompt === 0 || m.pricing?.prompt === '0') && 
                             (m.pricing?.completion === 0 || m.pricing?.completion === '0');
              let name = m.name || m.id;
              if (isFree && !name.toLowerCase().includes('free')) {
                name = `[Free] ${name}`;
              }
              return { id: m.id, name, isFree };
            }).sort((a, b) => {
              if (a.isFree && !b.isFree) return -1;
              if (!a.isFree && b.isFree) return 1;
              return a.name.localeCompare(b.name);
            });
            setAvailableModels(fetchedModels);
          }
        })
        .catch(err => {
          console.warn('OpenRouter dynamic model fetch fallback to defaults:', err);
          setAvailableModels(DEFAULT_MODELS);
        })
        .finally(() => setIsLoadingModels(false));
    }
  }, [showSettings]);

  // Separate Free models on top and all other models below
  const { freeModels, otherModels } = useMemo(() => {
    const term = modelSearch.trim().toLowerCase();
    const list = term 
      ? availableModels.filter(m => m.name.toLowerCase().includes(term) || m.id.toLowerCase().includes(term))
      : availableModels;

    const free = list.filter(m => m.isFree);
    const other = list.filter(m => !m.isFree);
    return { freeModels: free, otherModels: other };
  }, [availableModels, modelSearch]);

  const handleSend = async (textOverride = null) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    
    if (!textToSend.trim()) return;

    const userMessage = { role: 'user', content: textToSend };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Build comprehensive database & schema context
      const tableCount = schemaData?.tables?.length || 0;
      const spCount = spsData?.length || 0;
      const dbName = currentDatabase || 'master';

      // 1. Full schema markdown
      const schemaMd = schemaToMarkdown(schemaData, 100);
      
      // 2. High-level Architecture Summary
      let dbOverview = `### Active Database Environment\n`;
      dbOverview += `- **Current Database:** \`${dbName}\`\n`;
      dbOverview += `- **Total Tables:** ${tableCount}\n`;
      dbOverview += `- **Total Stored Procedures:** ${spCount}\n\n`;

      if (schemaData?.tables && schemaData.tables.length > 0) {
        const tableList = schemaData.tables.map(t => `${t.schema}.${t.name} (${t.columns.length} cols)`).join(', ');
        dbOverview += `**Table Directory:** ${tableList}\n\n`;

        // Relationship graph summary
        const relations = [];
        schemaData.tables.forEach(t => {
          if (t.foreignKeys && t.foreignKeys.length > 0) {
            t.foreignKeys.forEach(fk => {
              relations.push(`${t.schema}.${t.name}.${fk.column} ➔ ${fk.referencedSchema}.${fk.referencedTable}.${fk.referencedColumn}`);
            });
          }
        });
        if (relations.length > 0) {
          dbOverview += `**Foreign Key Relationships (${relations.length}):**\n${relations.slice(0, 40).map(r => `- ${r}`).join('\n')}\n\n`;
        }
      }

      // 3. Stored Procedures List
      let spContext = '';
      if (spsData && spsData.length > 0) {
        const spNames = spsData.map(sp => `${sp.schema_name}.${sp.sp_name}`).join(', ');
        spContext += `\n**Stored Procedures in Database (${spsData.length}):**\n${spNames}\n`;
      }

      // 4. Focus context (if specific table or SP is currently active)
      let focusContext = '';
      if (selectedSp && selectedSpDetails) {
        focusContext += `\n\n--- CURRENT FOCUS: USER IS INSPECTING STORED PROCEDURE ---\n`;
        focusContext += `Name: ${selectedSp.schema_name}.${selectedSp.sp_name}\n`;
        focusContext += `Dependencies:\n`;
        focusContext += `- Depends on: ${selectedSpDetails.dependsOn?.map(d => `${d.schema_name}.${d.entity_name} (${d.type})`).join(', ') || 'None'}\n`;
        focusContext += `- Referenced by: ${selectedSpDetails.referencedBy?.map(d => `${d.schema_name}.${d.entity_name} (${d.type})`).join(', ') || 'None'}\n`;
        focusContext += `Definition:\n\`\`\`sql\n${selectedSpDetails.definition}\n\`\`\`\n`;
        focusContext += `Parameters:\n${selectedSpDetails.parameters?.map(p => `- ${p.ParameterName} (${p.DataType})`).join('\n') || 'None'}\n`;
      }

      if (selectedTable && selectedTableDeps) {
        focusContext += `\n\n--- CURRENT FOCUS: USER IS INSPECTING TABLE ---\n`;
        focusContext += `Table: ${selectedTable}\n`;
        focusContext += `Dependencies & References:\n`;
        focusContext += `${selectedTableDeps.map(d => `- ${d.schema_name}.${d.entity_name} (${d.type})`).join('\n') || 'None'}\n`;
      }

      const systemPrompt = `You are an expert Microsoft SQL Server Database Architect and AI Assistant inside DB Visualizer.

## YOUR CAPABILITIES & CONTEXT
You have full awareness of the connected SQL Server database. Even when the user has NOT clicked on a specific table, you have the entire database catalog, tables, columns, primary keys, foreign key relationships, and stored procedures provided below.

${dbOverview}
${spContext}
${focusContext}

### Full Schema Definition:
${schemaMd}

## GUIDELINES
1. **Always use standard T-SQL (Microsoft SQL Server) syntax** for any SQL code blocks.
2. **Contextual Awareness**: Proactively reference existing tables and columns in the schema. When the user asks general questions without specifying a table (e.g. "how are customers linked to orders?", "give me an architecture overview", "suggest an index"), examine all tables in the schema and provide exact queries using the real table/column names.
3. **Safety First**: This is a read-only visualizer tool. Only suggest SELECT queries or non-destructive analysis scripts.
4. **Clarity**: Format responses cleanly in Markdown with bold headers, bullet points, and syntax-highlighted SQL blocks.`;

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model,
          apiKey
        })
      });

      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        throw new Error(`Server returned invalid JSON (Status: ${response.status}). Body: ${responseText.substring(0, 50)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to get response (Status: ${response.status})`);
      }

      const botMessage = data.choices && data.choices[0] ? data.choices[0].message : null;
      if (botMessage) {
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error('Invalid response format from OpenRouter');
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'system', content: `**Error:** ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle initial message from external components
  useEffect(() => {
    if (initialMessage && isOpen) {
      const msg = initialMessage;
      setInput(msg);
      if (onInitialMessageConsumed) onInitialMessageConsumed();
      const key = localStorage.getItem('openrouter_key');
      if (key) {
        handleSend(msg);
      }
    }
  }, [initialMessage, isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch full details of the selected SP
  useEffect(() => {
    if (selectedSp) {
      fetch(`/api/sps/${selectedSp.schema_name}/${selectedSp.sp_name}/analyze`)
        .then(res => res.json())
        .then(data => setSelectedSpDetails(data))
        .catch(err => console.error("Failed to fetch SP details for AI:", err));
    } else {
      setSelectedSpDetails(null);
    }
  }, [selectedSp]);

  // Fetch dependencies of the selected table
  useEffect(() => {
    if (selectedTable) {
      const parts = selectedTable.split('.');
      if (parts.length === 2) {
        fetch(`/api/tables/${parts[0]}/${parts[1]}/dependencies`)
          .then(res => res.json())
          .then(data => setSelectedTableDeps(data))
          .catch(err => console.error("Failed to fetch table deps for AI:", err));
      }
    } else {
      setSelectedTableDeps(null);
    }
  }, [selectedTable]);

  const saveSettings = () => {
    localStorage.setItem('openrouter_key', apiKey);
    localStorage.setItem('openrouter_model', model);
    setShowSettings(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="ai-chat-panel glass"
      style={{
        right: isDetailOpen ? `calc(${detailWidth} + 1.25rem)` : '1.5rem',
        transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <div className="ai-header-badge">
            <Bot size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Schema Assistant</div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-tertiary)' }}>
              {currentDatabase ? `DB: ${currentDatabase}` : 'Full Schema Context'} • {model.split('/')[1] || model}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button className="btn-icon-subtle" onClick={() => setShowSettings(!showSettings)} title="Model & API Settings">
            <Settings size={15} />
          </button>
          <button className="btn-icon-subtle" onClick={onClose} title="Close Assistant">
            <X size={15} />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="ai-chat-settings custom-scrollbar">
          <div className="settings-header" style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>AI Configuration</h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Enter your OpenRouter API key to chat with AI</p>
          </div>
          
          <div className="form-field-group" style={{ marginBottom: '1rem' }}>
            <label className="form-field-label">OpenRouter API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="form-input-field"
            />
            <span className="form-field-hint">
              Stored locally in your browser only. Free & paid models supported.
            </span>
          </div>

          <div className="form-field-group" style={{ marginBottom: '1rem' }}>
            <label className="form-field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Model Selection ({availableModels.length} models)</span>
              {isLoadingModels && <Loader2 size={12} className="animate-spin" />}
            </label>

            {availableModels.length > 10 && (
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <input 
                  type="text" 
                  value={modelSearch} 
                  onChange={(e) => setModelSearch(e.target.value)} 
                  placeholder="Filter models (e.g. gpt, free, claude, deepseek)..."
                  className="form-input-field"
                  style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                />
              </div>
            )}

            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              disabled={isLoadingModels}
              className="form-input-field"
              style={{ maxHeight: '200px' }}
            >
              {freeModels.length > 0 && (
                <optgroup label={`🎁 Free Models (${freeModels.length})`}>
                  {freeModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
              {otherModels.length > 0 && (
                <optgroup label={`⚡ All Models (${otherModels.length})`}>
                  {otherModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
              {freeModels.length === 0 && otherModels.length === 0 && (
                <option value="" disabled>No matching models found</option>
              )}
            </select>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={saveSettings}>
            Save Configuration
          </button>
        </div>
      ) : (
        <>
          <div className="ai-chat-messages custom-scrollbar">
            {messages.length === 0 && (
              <div className="empty-chat">
                <div className="empty-chat-icon">
                  <Sparkles size={24} />
                </div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Ask AI about {currentDatabase ? `"${currentDatabase}"` : 'your database'}
                </h4>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                  {schemaData?.tables?.length 
                    ? `AI has full context of all ${schemaData.tables.length} tables and ${spsData?.length || 0} stored procedures.`
                    : 'Connect to a database to analyze tables, relationships, and queries.'}
                </p>
                
                <div className="suggestions-list">
                  <button className="suggestion-pill" onClick={() => handleSend('Provide a comprehensive architectural overview of this database schema and key domain entities.')}>
                    <Sparkles size={11} className="pill-icon" />
                    <span>Explain full schema architecture</span>
                  </button>
                  <button className="suggestion-pill" onClick={() => handleSend('Analyze all foreign keys and summarize how tables link together.')}>
                    <Sparkles size={11} className="pill-icon" />
                    <span>Map table relationships & FKs</span>
                  </button>
                  <button className="suggestion-pill" onClick={() => handleSend('List all stored procedures in this database and summarize their roles.')}>
                    <Zap size={11} className="pill-icon" />
                    <span>Stored procedures summary</span>
                  </button>
                  <button className="suggestion-pill" onClick={() => handleSend('Identify potential missing foreign keys, orphan tables, or missing indexes.')}>
                    <HelpCircle size={11} className="pill-icon" />
                    <span>Find missing relations & index suggestions</span>
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="message-avatar bot">
                    <Bot size={13} />
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="message-avatar user">
                    <User size={13} />
                  </div>
                )}
                <div className="message-content">
                  {msg.role === 'system' && msg.content.startsWith('**Error:**') ? (
                    <div style={{ color: 'var(--danger)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <AlertCircle size={14}/> {msg.content.replace('**Error:** ', '')}
                    </div>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-message assistant">
                <div className="message-avatar bot">
                  <Bot size={13} />
                </div>
                <div className="message-content loading-bubble">
                  <Loader2 size={15} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-input-box">
            <textarea
              placeholder="Ask anything about this database schema... (Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="chat-textarea"
            />
            <button 
              className="chat-send-btn" 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              title="Send message (Enter)"
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
