import React, { useState } from 'react';
import { getSchemaColor } from '../utils/schemaToFlow';
import { ChevronUp, ChevronDown, Layers } from 'lucide-react';

export default function SchemaLegend({ schemaData }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!schemaData || !schemaData.tables || schemaData.tables.length === 0) return null;

  // Group by schema and count
  const schemaCounts = {};
  schemaData.tables.forEach(t => {
    schemaCounts[t.schema] = (schemaCounts[t.schema] || 0) + 1;
  });

  const schemas = Object.entries(schemaCounts).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="schema-legend-card glass">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="schema-legend-header"
      >
        <div className="schema-legend-title">
          <Layers size={13} className="text-accent" />
          <span>Schemas</span>
          <span className="schema-badge-count">{schemas.length}</span>
        </div>
        {isOpen ? <ChevronDown size={13} className="legend-chevron" /> : <ChevronUp size={13} className="legend-chevron" />}
      </div>
      
      {isOpen && (
        <div className="schema-legend-body custom-scrollbar">
          {schemas.map(([schema, count]) => (
            <div key={schema} className="schema-legend-row">
              <div 
                className="schema-color-dot" 
                style={{ backgroundColor: getSchemaColor(schema) }} 
              />
              <span className="schema-legend-name">{schema}</span>
              <span className="schema-legend-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
