export function schemaToMarkdown(schemaData, maxTables = 50) {
  if (!schemaData || !schemaData.tables) return 'No schema available.';

  let md = '# Database Schema\n\n';

  const tablesToInclude = schemaData.tables.slice(0, maxTables);

  tablesToInclude.forEach(table => {
    md += `## Table: ${table.schema}.${table.name}\n`;
    
    // Columns
    const cols = table.columns.map(c => {
      let flags = [];
      if (c.isPrimaryKey) flags.push('PK');
      if (c.isForeignKey) flags.push('FK');
      if (!c.isNullable) flags.push('NOT NULL');
      
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      return `- ${c.name} (${c.dataType})${flagStr}`;
    });
    
    md += cols.join('\n') + '\n\n';

    // Foreign Keys
    if (table.foreignKeys && table.foreignKeys.length > 0) {
      md += `**Relationships:**\n`;
      table.foreignKeys.forEach(fk => {
        md += `- ${fk.column} -> ${fk.referencedSchema}.${fk.referencedTable}(${fk.referencedColumn})\n`;
      });
      md += '\n';
    }
  });

  if (schemaData.tables.length > maxTables) {
    md += `\n*Note: Schema representation truncated to first ${maxTables} of ${schemaData.tables.length} tables to optimize AI context window.*\n`;
  }

  return md;
}
