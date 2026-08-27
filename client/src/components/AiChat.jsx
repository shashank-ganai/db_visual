import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Settings, MessageSquare, Loader2, Database, AlertCircle, 
  Sparkles, Bot, User, Check, Copy, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { schemaToMarkdown } from '../utils/schemaToMarkdown';

const MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'anthropic/claude-3-haiku:beta', name: 'Claude 3 Haiku' }
];

export default function AiChat({ 
  isOpen, 
  onClose, 
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
  
  const [availableModels, setAvailableModels] = useState(MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

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

  // Fetch available models from OpenRouter when settings are opened
  useEffect(() => {
    if (showSettings) {
      setIsLoadingModels(true);
      fetch('https://openrouter.ai/api/v1/models')
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            const fetchedModels = data.data.map(m => {
              const isFree = m.pricing?.prompt == 0 && m.pricing?.completion == 0;
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
        .catch(err => console.error('Failed to fetch OpenRouter models:', err))
        .finally(() => setIsLoadingModels(false));
    }
  }, [showSettings]);

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
      // Build the system prompt with schema context
      const schemaMd = schemaToMarkdown(schemaData);
      
      let spContext = '';
      if (spsData && spsData.length > 0) {
        const spNames = spsData.map(sp => sp.sp_name).join(', ');
        spContext += `\n\nThe database also contains the following Stored Procedures: ${spNames}.`;
      }
      if (selectedSp && selectedSpDetails) {
        spContext += `\n\n**USER IS CURRENTLY VIEWING THIS STORED PROCEDURE:**\n`;
        spContext += `Name: ${selectedSp.schema_name}.${selectedSp.sp_name}\n`;
        spContext += `Dependencies:\n`;
        spContext += `- Depends on: ${selectedSpDetails.dependsOn?.map(d => `${d.schema_name}.${d.entity_name} (${d.type})`).join(', ') || 'None'}\n`;
        spContext += `- Referenced by: ${selectedSpDetails.referencedBy?.map(d => `${d.schema_name}.${d.entity_name} (${d.type})`).join(', ') || 'None'}\n`;
        spContext += `Definition:\n\`\`\`sql\n${selectedSpDetails.definition}\n\`\`\`\n`;
        spContext += `Parameters:\n${selectedSpDetails.parameters?.map(p => `- ${p.ParameterName} (${p.DataType})`).join('\n') || 'None'}\n`;
      }

      if (selectedTable && selectedTableDeps) {
        spContext += `\n\n**USER IS CURRENTLY VIEWING THIS TABLE:**\n`;
        spContext += `Name: ${selectedTable}\n`;
        spContext += `It is referenced by the following objects (Dependencies):\n`;
        spContext += `${selectedTableDeps.map(d => `- ${d.schema_name}.${d.entity_name} (${d.type})`).join('\n') || 'None'}\n`;
      }

      const systemPrompt = `You are an expert Microsoft SQL Server Database Architect and AI Assistant inside DB Visualizer.
Your job is to answer questions about the database schema, write optimized and safe SQL queries, explain relationships, suggest performance improvements, or identify missing indexes.

Here is the markdown representation of the current active database schema:
${schemaMd}
${spContext}

Guidelines:
1. When generating SQL, ALWAYS output ONLY standard Microsoft SQL Server (T-SQL) syntax.
2. Only suggest read-only queries (SELECT) or safe CREATE INDEX statements. Never generate DROP, DELETE, or destructive queries without strong warnings.
3. Keep answers concise, clear, and formatted nicely in Markdown with syntax-highlighted SQL blocks.`;

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
            <div style={{ fontSize: '0.675rem', color: 'var(--text-tertiary)' }}>{model.split('/')[1] || model}</div>
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
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Configure your OpenRouter API credentials</p>
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
              Stored locally in your browser only.
            </span>
          </div>

          <div className="form-field-group" style={{ marginBottom: '1rem' }}>
            <label className="form-field-label">
              Model {isLoadingModels && <Loader2 size={12} className="animate-spin" style={{ display: 'inline', marginLeft: '6px' }} />}
            </label>
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              disabled={isLoadingModels}
              className="form-input-field"
            >
              {availableModels.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
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
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Ask AI about your database</h4>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Generate complex JOIN queries, diagnose relationships, or get index recommendations.
                </p>
                
                <div className="suggestions-list">
                  <button className="suggestion-pill" onClick={() => handleSend('Explain this schema architecture and its primary business domains')}>
                    <Sparkles size={11} className="pill-icon" />
                    <span>Explain schema architecture</span>
                  </button>
                  <button className="suggestion-pill" onClick={() => handleSend('Identify potential missing foreign keys or orphan tables')}>
                    <Sparkles size={11} className="pill-icon" />
                    <span>Find missing relations / orphans</span>
                  </button>
                  <button className="suggestion-pill" onClick={() => handleSend('Suggest performance indexes for tables with high row counts')}>
                    <Sparkles size={11} className="pill-icon" />
                    <span>Suggest performance indexes</span>
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
              placeholder="Ask about your schema... (Shift+Enter for newline)"
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
