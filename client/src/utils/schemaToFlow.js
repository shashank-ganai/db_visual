// Color palette for different schemas
const SCHEMA_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#f43f5e'  // rose
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getSchemaColor(schemaName) {
  const index = hashString(schemaName) % SCHEMA_COLORS.length;
  return SCHEMA_COLORS[index];
}

export function schemaToFlow(schemaData) {
  const nodes = [];
  const edges = [];
  
  if (!schemaData || !schemaData.tables) return { nodes, edges };

  // 1. Create Nodes
  schemaData.tables.forEach(table => {
    const id = `${table.schema}.${table.name}`;
    
    nodes.push({
      id,
      type: 'tableNode',
      position: { x: 0, y: 0 }, // Position will be set by ELK
      data: {
        schema: table.schema,
        name: table.name,
        columns: table.columns,
        primaryKeys: table.primaryKeys,
        foreignKeys: table.foreignKeys,
        indexes: table.indexes,
        rowCount: table.rowCount,
        createDate: table.createDate,
        modifyDate: table.modifyDate,
        color: getSchemaColor(table.schema)
      }
    });
  });

  // 2. Create Edges
  schemaData.foreignKeys.forEach(fk => {
    const sourceId = `${fk.parentSchema}.${fk.parentTable}`;
    const targetId = `${fk.referencedSchema}.${fk.referencedTable}`;
    
    edges.push({
      id: fk.constraintName,
      source: sourceId,
      target: targetId,
      sourceHandle: fk.parentColumn,
      targetHandle: fk.referencedColumn,
      type: 'smoothstep',
      animated: false,
      label: `${fk.parentColumn} → ${fk.referencedColumn}`,
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: 'var(--bg-secondary)', stroke: 'var(--border)', strokeWidth: 1 },
      labelStyle: { fill: 'var(--text-secondary)', fontWeight: 500, fontSize: 10 },
      style: { 
        stroke: 'var(--text-tertiary)', 
        strokeWidth: 1.5,
        strokeDasharray: fk.isImplicit ? '5,5' : 'none'
      },
      data: {
        constraintName: fk.constraintName,
        sourceCol: fk.parentColumn,
        targetCol: fk.referencedColumn
      }
    });
  });

  return { nodes, edges };
}
