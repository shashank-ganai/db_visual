import React from 'react';
import { Database, Link, Code, Layers } from 'lucide-react';

export default function StatsBar({ schemaData, spsData, isDetailOpen, detailWidth = '400px' }) {
  if (!schemaData) return null;

  const tableCount = schemaData.tables?.length || 0;
  const relCount = schemaData.foreignKeys?.length || 0;
  const spCount = spsData?.length || 0;
  const schemas = new Set(schemaData.tables?.map(t => t.schema) || []);

  return (
    <div 
      className="stats-footer-bar"
      style={{
        right: isDetailOpen ? detailWidth : 0,
      }}
    >
      <div className="stats-metric-item">
        <Database size={12} className="metric-icon" />
        <span><strong>{tableCount}</strong> Tables</span>
      </div>

      <div className="stats-divider" />

      <div className="stats-metric-item">
        <Link size={12} className="metric-icon" />
        <span><strong>{relCount}</strong> Relationships</span>
      </div>

      <div className="stats-divider" />

      <div className="stats-metric-item">
        <Code size={12} className="metric-icon" />
        <span><strong>{spCount}</strong> Stored Procedures</span>
      </div>

      <div className="stats-divider" />

      <div className="stats-metric-item">
        <Layers size={12} className="metric-icon" />
        <span><strong>{schemas.size}</strong> Schemas</span>
      </div>
    </div>
  );
}
