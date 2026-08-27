import React, { useMemo } from 'react';
import { 
  AlertTriangle, ShieldCheck, AlertCircle, Info, Table2, 
  Key, ArrowRight, ExternalLink, CheckCircle2, RefreshCw 
} from 'lucide-react';

export default function SchemaHealth({ schemaData, onSelectTable }) {
  // Analyze schema metadata and generate issues
  const { issues, stats, healthScore } = useMemo(() => {
    if (!schemaData || !schemaData.tables) {
      return { issues: [], stats: { total: 0, critical: 0, warning: 0, info: 0 }, healthScore: 100 };
    }

    const items = [];
    const tables = schemaData.tables;
    const foreignKeys = schemaData.foreignKeys || [];

    // 1. Check for Tables without Primary Keys (Critical)
    tables.forEach(table => {
      if (!table.primaryKeys || table.primaryKeys.length === 0) {
        items.push({
          id: `no-pk-${table.schema}.${table.name}`,
          type: 'no_pk',
          severity: 'critical',
          category: 'Integrity',
          tableId: `${table.schema}.${table.name}`,
          title: `Table without Primary Key (Heap Table)`,
          description: `Table "${table.schema}.${table.name}" has no primary key defined. This can cause severe table scans, heap fragmentation, and replication issues.`,
          recommendation: `Add a clustered Primary Key on a unique identifying column (e.g. Id).`
        });
      }
    });

    // 2. Check for Unindexed Foreign Keys (Warning / Performance)
    foreignKeys.forEach(fk => {
      if (fk.isImplicit) return; // Skip inferred FKs for linter

      const parentTable = tables.find(t => t.schema === fk.parentSchema && t.name === fk.parentTable);
      if (parentTable) {
        // Check if any index contains parentColumn as the leading or included column
        const hasIndex = (parentTable.indexes || []).some(idx => {
          return idx.columns && idx.columns.some(col => col.toLowerCase() === fk.parentColumn.toLowerCase());
        });

        if (!hasIndex) {
          items.push({
            id: `unindexed-fk-${fk.constraintName}`,
            type: 'unindexed_fk',
            severity: 'warning',
            category: 'Performance',
            tableId: `${fk.parentSchema}.${fk.parentTable}`,
            title: `Unindexed Foreign Key: "${fk.parentColumn}"`,
            description: `Foreign key "${fk.parentColumn}" referencing "${fk.referencedTable}.${fk.referencedColumn}" has no supporting index.`,
            recommendation: `Create a non-clustered index on [${fk.parentSchema}].[${fk.parentTable}]([${fk.parentColumn}]) to optimize JOIN and DELETE performance.`
          });
        }
      }
    });

    // 3. Check for Very Wide Tables (Info / Design)
    tables.forEach(table => {
      if (table.columns && table.columns.length >= 40) {
        items.push({
          id: `wide-table-${table.schema}.${table.name}`,
          type: 'wide_table',
          severity: 'info',
          category: 'Design',
          tableId: `${table.schema}.${table.name}`,
          title: `Wide Table (${table.columns.length} columns)`,
          description: `Table "${table.schema}.${table.name}" has ${table.columns.length} columns. Wide tables can exceed maximum page row sizes and slow down SELECT * operations.`,
          recommendation: `Consider vertical partitioning or moving rarely-accessed columns into a satellite table.`
        });
      }
    });

    // 4. Check for Nullable Foreign Keys (Info)
    tables.forEach(table => {
      table.columns.forEach(col => {
        if (col.isForeignKey && col.isNullable && !col.isPrimaryKey) {
          items.push({
            id: `nullable-fk-${table.schema}.${table.name}.${col.name}`,
            type: 'nullable_fk',
            severity: 'info',
            category: 'Integrity',
            tableId: `${table.schema}.${table.name}`,
            title: `Nullable Foreign Key: "${col.name}"`,
            description: `Column "${col.name}" in "${table.name}" is a Foreign Key that permits NULL values (optional relationship).`,
            recommendation: `Ensure application logic handles orphaned or detached records appropriately.`
          });
        }
      });
    });

    // Calculate Counts & Score
    const criticalCount = items.filter(i => i.severity === 'critical').length;
    const warningCount = items.filter(i => i.severity === 'warning').length;
    const infoCount = items.filter(i => i.severity === 'info').length;

    // Health Score Formula: Start with 100, deduct 12 per critical, 4 per warning, 1 per info (min 10)
    const penalty = (criticalCount * 12) + (warningCount * 4) + (infoCount * 1);
    const score = Math.max(10, Math.min(100, Math.round(100 - penalty)));

    return {
      issues: items,
      stats: {
        total: items.length,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount
      },
      healthScore: score
    };
  }, [schemaData]);

  const scoreColor = healthScore >= 85 ? 'var(--success, #10b981)' : healthScore >= 60 ? 'var(--warning, #f59e0b)' : 'var(--danger, #ef4444)';

  return (
    <div className="schema-health-container">
      {/* Score Header Card */}
      <div className="health-score-card">
        <div className="health-score-circle" style={{ borderColor: scoreColor }}>
          <span className="health-score-value" style={{ color: scoreColor }}>{healthScore}</span>
          <span className="health-score-label">SCORE</span>
        </div>
        <div className="health-score-details">
          <h4>Database Health & Linter</h4>
          <p>
            {healthScore >= 85 
              ? 'Great schema structure! Low risk detected.' 
              : healthScore >= 60 
              ? 'Moderate issues found. Recommended index adjustments.' 
              : 'Action needed! Missing PKs or unindexed FKs found.'}
          </p>
          <div className="health-stats-pills">
            <span className="health-pill critical">
              <AlertCircle size={12} /> {stats.critical} Critical
            </span>
            <span className="health-pill warning">
              <AlertTriangle size={12} /> {stats.warning} Warnings
            </span>
            <span className="health-pill info">
              <Info size={12} /> {stats.info} Info
            </span>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="health-issues-list">
        {issues.length === 0 ? (
          <div className="health-empty-state">
            <CheckCircle2 size={36} color="var(--success, #10b981)" />
            <p>No structural schema issues detected!</p>
            <span>All tables have primary keys and all foreign keys have supporting indexes.</span>
          </div>
        ) : (
          issues.map(issue => (
            <div 
              key={issue.id} 
              className={`health-issue-item ${issue.severity}`}
              onClick={() => onSelectTable?.(issue.tableId)}
              title="Click to locate table on canvas"
            >
              <div className="health-issue-header">
                <div className="health-issue-title-group">
                  {issue.severity === 'critical' ? (
                    <AlertCircle size={15} className="text-danger" />
                  ) : issue.severity === 'warning' ? (
                    <AlertTriangle size={15} className="text-warning" />
                  ) : (
                    <Info size={15} className="text-info" />
                  )}
                  <strong>{issue.title}</strong>
                </div>
                <span className={`health-badge ${issue.severity}`}>
                  {issue.severity.toUpperCase()}
                </span>
              </div>

              <p className="health-issue-desc">{issue.description}</p>
              
              <div className="health-issue-rec">
                <span>💡 {issue.recommendation}</span>
              </div>

              <div className="health-issue-footer">
                <span className="health-target-table">
                  <Table2 size={12} /> {issue.tableId}
                </span>
                <span className="health-locate-link">
                  Locate on canvas <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
