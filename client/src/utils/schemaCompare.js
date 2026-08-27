/**
 * Normalizes SQL script text for accurate semantic diffing:
 * - Unifies line breaks (\r\n and \r -> \n)
 * - Trims trailing whitespace from every line
 * - Trims leading and trailing blank lines
 * - Optionally strips comments or excessive inline whitespace
 */
export function normalizeSql(sql, options = {}) {
  if (!sql || typeof sql !== 'string') return '';
  
  // 1. Normalize line breaks
  let text = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Optionally remove comments
  if (options.ignoreComments) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');
    text = text.replace(/--.*$/gm, '');
  }

  // 3. Trim trailing whitespace from each line & ignore blank trailing/leading lines
  const lines = text.split('\n').map(l => l.trimEnd());
  
  // Remove leading empty lines
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  let result = lines.join('\n');

  // 4. Optionally ignore all multiple spaces/indentation variations
  if (options.ignoreAllWhitespace) {
    result = result.replace(/[ \t]+/g, ' ');
  }

  return result;
}

export function compareDatabases(sourceSchema, targetSchema, sourceSps, targetSps, options = { ignoreWhitespace: true }) {
  const result = {
    tables: {
      onlyInSource: [],
      onlyInTarget: [],
      modified: []
    },
    sps: {
      onlyInSource: [],
      onlyInTarget: [],
      modified: []
    }
  };

  // --- Compare Tables ---
  const sourceTableMap = {};
  sourceSchema?.tables?.forEach(t => {
    sourceTableMap[`${t.schema}.${t.name}`.toLowerCase()] = t;
  });

  const targetTableMap = {};
  targetSchema?.tables?.forEach(t => {
    targetTableMap[`${t.schema}.${t.name}`.toLowerCase()] = t;
  });

  Object.keys(sourceTableMap).forEach(key => {
    if (!targetTableMap[key]) {
      result.tables.onlyInSource.push(sourceTableMap[key]);
    } else {
      // Compare common table
      const diff = compareTableDetails(sourceTableMap[key], targetTableMap[key]);
      if (diff.hasDifferences) {
        result.tables.modified.push(diff);
      }
    }
  });

  Object.keys(targetTableMap).forEach(key => {
    if (!sourceTableMap[key]) {
      result.tables.onlyInTarget.push(targetTableMap[key]);
    }
  });

  // --- Compare SPs ---
  const sourceSpMap = {};
  sourceSps?.forEach(sp => {
    sourceSpMap[`${sp.schema_name}.${sp.sp_name}`.toLowerCase()] = sp;
  });

  const targetSpMap = {};
  targetSps?.forEach(sp => {
    targetSpMap[`${sp.schema_name}.${sp.sp_name}`.toLowerCase()] = sp;
  });

  Object.keys(sourceSpMap).forEach(key => {
    if (!targetSpMap[key]) {
      result.sps.onlyInSource.push(sourceSpMap[key]);
    } else {
      const srcSp = sourceSpMap[key];
      const tgtSp = targetSpMap[key];

      // Compare actual SQL code definitions if available
      if (srcSp.definition !== undefined && tgtSp.definition !== undefined) {
        const srcNorm = normalizeSql(srcSp.definition, options);
        const tgtNorm = normalizeSql(tgtSp.definition, options);

        if (srcNorm !== tgtNorm) {
          result.sps.modified.push({
            source: srcSp,
            target: tgtSp,
            sourceDefinition: srcSp.definition,
            targetDefinition: tgtSp.definition
          });
        }
      } else {
        // Fallback only if definitions are not in memory
        const srcDate = new Date(srcSp.modify_date).getTime();
        const tgtDate = new Date(tgtSp.modify_date).getTime();
        if (Math.abs(srcDate - tgtDate) > 2000) {
          result.sps.modified.push({
            source: srcSp,
            target: tgtSp
          });
        }
      }
    }
  });

  Object.keys(targetSpMap).forEach(key => {
    if (!sourceSpMap[key]) {
      result.sps.onlyInTarget.push(targetSpMap[key]);
    }
  });

  return result;
}

function compareTableDetails(srcTable, tgtTable) {
  const diff = {
    tableName: `${srcTable.schema}.${srcTable.name}`,
    columns: {
      onlyInSource: [],
      onlyInTarget: [],
      modified: []
    },
    keys: {
      pkDifferences: false,
      fkDifferences: false
    },
    hasDifferences: false
  };

  // Compare columns (case-insensitive name match)
  const srcColMap = {};
  srcTable.columns.forEach(c => srcColMap[c.name.toLowerCase()] = c);
  
  const tgtColMap = {};
  tgtTable.columns.forEach(c => tgtColMap[c.name.toLowerCase()] = c);

  Object.keys(srcColMap).forEach(colKey => {
    if (!tgtColMap[colKey]) {
      diff.columns.onlyInSource.push(srcColMap[colKey]);
      diff.hasDifferences = true;
    } else {
      const srcCol = srcColMap[colKey];
      const tgtCol = tgtColMap[colKey];
      const mods = [];
      
      if ((srcCol.dataType || '').toLowerCase() !== (tgtCol.dataType || '').toLowerCase()) {
        mods.push(`Type: ${srcCol.dataType} vs ${tgtCol.dataType}`);
      }
      if (srcCol.isNullable !== tgtCol.isNullable) {
        mods.push(`Nullable: ${srcCol.isNullable ? 'YES' : 'NO'} vs ${tgtCol.isNullable ? 'YES' : 'NO'}`);
      }
      if (srcCol.maxLength !== tgtCol.maxLength && srcCol.maxLength !== undefined && tgtCol.maxLength !== undefined) {
        mods.push(`Length: ${srcCol.maxLength} vs ${tgtCol.maxLength}`);
      }
      
      if (mods.length > 0) {
        diff.columns.modified.push({ colName: srcCol.name, changes: mods });
        diff.hasDifferences = true;
      }
    }
  });

  Object.keys(tgtColMap).forEach(colKey => {
    if (!srcColMap[colKey]) {
      diff.columns.onlyInTarget.push(tgtColMap[colKey]);
      diff.hasDifferences = true;
    }
  });

  // Compare Primary Keys
  const srcPkStr = [...srcTable.primaryKeys].map(k => k.toLowerCase()).sort().join(',');
  const tgtPkStr = [...tgtTable.primaryKeys].map(k => k.toLowerCase()).sort().join(',');
  if (srcPkStr !== tgtPkStr) {
    diff.keys.pkDifferences = true;
    diff.keys.srcPk = srcTable.primaryKeys;
    diff.keys.tgtPk = tgtTable.primaryKeys;
    diff.hasDifferences = true;
  }

  // Compare Foreign Keys
  const srcFkStr = [...srcTable.foreignKeys].map(fk => `${fk.column.toLowerCase()}->${fk.referencedSchema.toLowerCase()}.${fk.referencedTable.toLowerCase()}.${fk.referencedColumn.toLowerCase()}`).sort().join('|');
  const tgtFkStr = [...tgtTable.foreignKeys].map(fk => `${fk.column.toLowerCase()}->${fk.referencedSchema.toLowerCase()}.${fk.referencedTable.toLowerCase()}.${fk.referencedColumn.toLowerCase()}`).sort().join('|');
  if (srcFkStr !== tgtFkStr) {
    diff.keys.fkDifferences = true;
    diff.keys.srcFks = srcTable.foreignKeys;
    diff.keys.tgtFks = tgtTable.foreignKeys;
    diff.hasDifferences = true;
  }

  return diff;
}
