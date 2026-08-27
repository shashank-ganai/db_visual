import { useMemo, useCallback } from 'react';

/**
 * Creates an alias for a SQL table name.
 * e.g. "OrderDetails" -> "od", "Users" -> "u", "tbl_student" -> "ts"
 */
function generateAlias(tableName, usedAliases) {
  const clean = tableName.replace(/^(tbl_|tbl|t_)/i, '');
  let alias = clean
    .split(/[-_ ]|(?=[A-Z])/)
    .filter(Boolean)
    .map(w => w[0].toLowerCase())
    .join('');

  if (!alias) alias = 't';
  
  let finalAlias = alias;
  let counter = 1;
  while (usedAliases.has(finalAlias)) {
    finalAlias = `${alias}${counter++}`;
  }
  usedAliases.add(finalAlias);
  return finalAlias;
}

export function usePathFinder(schemaData) {
  // Build adjacency graph from foreign keys (both directions)
  const graph = useMemo(() => {
    if (!schemaData || !schemaData.foreignKeys) return new Map();

    const adj = new Map();

    const addEdge = (from, to, fk, isReverse) => {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from).push({ to, fk, isReverse });
    };

    schemaData.foreignKeys.forEach(fk => {
      const parentId = `${fk.parentSchema}.${fk.parentTable}`;
      const refId = `${fk.referencedSchema}.${fk.referencedTable}`;

      // Forward: parent (child table with FK column) -> referenced (parent table with PK)
      addEdge(parentId, refId, fk, false);
      // Reverse: referenced -> parent
      addEdge(refId, parentId, fk, true);
    });

    return adj;
  }, [schemaData]);

  /**
   * Finds the shortest foreign-key path between startTableId and targetTableId using BFS.
   */
  const findPath = useCallback((startTableId, targetTableId) => {
    if (!startTableId || !targetTableId) return null;
    if (startTableId === targetTableId) {
      return {
        found: true,
        path: [startTableId],
        steps: [],
        edgeIds: [],
        sql: `SELECT * FROM [${startTableId.replace('.', '].[')}]`
      };
    }

    const queue = [startTableId];
    const visited = new Set([startTableId]);
    const parentMap = new Map(); // tableId -> { prevTable, step }

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === targetTableId) break;

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.to)) {
          visited.add(neighbor.to);
          parentMap.set(neighbor.to, { prevTable: current, step: neighbor });
          queue.push(neighbor.to);
        }
      }
    }

    if (!parentMap.has(targetTableId)) {
      return {
        found: false,
        path: [],
        steps: [],
        edgeIds: [],
        sql: `-- No Foreign Key relationship path found between ${startTableId} and ${targetTableId}`
      };
    }

    // Reconstruct path
    const path = [];
    const steps = [];
    const edgeIds = [];
    let curr = targetTableId;

    while (curr !== startTableId) {
      path.unshift(curr);
      const info = parentMap.get(curr);
      steps.unshift(info.step);
      if (info.step.fk?.constraintName) {
        edgeIds.push(info.step.fk.constraintName);
      }
      curr = info.prevTable;
    }
    path.unshift(startTableId);

    // Generate SQL query
    const usedAliases = new Map(); // tableId -> alias
    const startParts = startTableId.split('.');
    const startSchema = startParts[0];
    const startName = startParts[1];
    const startAlias = generateAlias(startName, new Set(usedAliases.values()));
    usedAliases.set(startTableId, startAlias);

    let sqlLines = [
      `SELECT TOP 100`,
      `  *`,
      `FROM [${startSchema}].[${startName}] AS ${startAlias}`
    ];

    let prevTableId = startTableId;
    steps.forEach((step) => {
      const nextTableId = step.to;
      const nextParts = nextTableId.split('.');
      const nextSchema = nextParts[0];
      const nextName = nextParts[1];
      const nextAlias = generateAlias(nextName, new Set(usedAliases.values()));
      usedAliases.set(nextTableId, nextAlias);

      const prevAlias = usedAliases.get(prevTableId);
      const fk = step.fk;

      if (!step.isReverse) {
        // Step goes from parentTable (child) to referencedTable (parent)
        // prevTable is child (fk.parentTable), nextTable is parent (fk.referencedTable)
        sqlLines.push(
          `INNER JOIN [${nextSchema}].[${nextName}] AS ${nextAlias} ` +
          `ON ${prevAlias}.[${fk.parentColumn}] = ${nextAlias}.[${fk.referencedColumn}]`
        );
      } else {
        // Step goes from referencedTable (parent) to parentTable (child)
        // prevTable is parent (fk.referencedTable), nextTable is child (fk.parentTable)
        sqlLines.push(
          `INNER JOIN [${nextSchema}].[${nextName}] AS ${nextAlias} ` +
          `ON ${nextAlias}.[${fk.parentColumn}] = ${prevAlias}.[${fk.referencedColumn}]`
        );
      }

      prevTableId = nextTableId;
    });

    return {
      found: true,
      path,
      steps,
      edgeIds,
      sql: sqlLines.join('\n')
    };
  }, [graph]);

  return { findPath };
}
