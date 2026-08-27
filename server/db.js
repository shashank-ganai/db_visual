const sql = require('mssql');

const crypto = require('crypto');

const activePools = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activePools.entries()) {
    if (now - session.lastAccessed > 3600000) { // 1 hour
      console.log(`Cleaning up inactive database connection: ${id}`);
      if (session.pool) {
        session.pool.close().catch(e => console.error('Error closing inactive pool', e));
      }
      activePools.delete(id);
    }
  }
}, 600000);

function getPool(connectionId) {
  const session = activePools.get(connectionId);
  if (session) {
    session.lastAccessed = Date.now();
    return session.pool;
  }
  return null;
}

function getConfig(connectionId) {
  const session = activePools.get(connectionId);
  return session ? session.config : null;
}

function resolvePool(idOrPool) {
  if (typeof idOrPool === 'string') return getPool(idOrPool);
  return idOrPool;
}

/**
 * Builds a safe, typed mssql config object from raw user input.
 * Ensures port is always a number and instanceName is parsed from the server string.
 * This is the single source of truth for config construction — used by connect(),
 * getFullSchemaForDatabase(), and getSpDefinitionForDatabase().
 *
 * @param {Object} rawConfig - Raw config (may have string port, backslash instance name, etc.)
 * @param {string} [dbOverride] - Optional database name to use instead of rawConfig.database
 * @returns {Object|string} A valid mssql config object or connection string
 */
function buildMssqlConfig(rawConfig, dbOverride) {
  if (!rawConfig) {
    throw new Error('Connection configuration is required');
  }

  if (typeof rawConfig === 'string') {
    let cs = rawConfig;
    if (dbOverride) {
      if (/Database=[^;]+/i.test(cs)) {
        cs = cs.replace(/Database=[^;]+/i, `Database=${dbOverride}`);
      } else {
        cs = `${cs.trim().replace(/;$/, '')};Database=${dbOverride};`;
      }
    }
    return cs;
  }

  if (rawConfig.connectionString) {
    // For connection strings, let mssql parse it — it always produces numeric port
    let cs = rawConfig.connectionString;
    if (dbOverride) {
      if (/Database=[^;]+/i.test(cs)) {
        cs = cs.replace(/Database=[^;]+/i, `Database=${dbOverride}`);
      } else {
        cs = `${cs.trim().replace(/;$/, '')};Database=${dbOverride};`;
      }
    }
    return cs;
  }

  let serverHost = rawConfig.server || '';
  let instanceName = undefined;

  // Parse SERVER\INSTANCE format
  if (serverHost.includes('\\')) {
    const parts = serverHost.split('\\');
    serverHost = parts[0];
    instanceName = parts[1];
  }

  const portNum = rawConfig.port && !isNaN(parseInt(rawConfig.port, 10))
    ? parseInt(rawConfig.port, 10)
    : 1433;

  return {
    user: rawConfig.user,
    password: rawConfig.password,
    server: serverHost,
    database: dbOverride !== undefined ? dbOverride : rawConfig.database,
    port: portNum,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      ...(instanceName ? { instanceName } : {})
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

/**
 * Connects to the SQL Server database.
 * Supports both raw connection strings and structured config objects.
 * Handles parsing instance names (e.g. SERVER\SQLEXPRESS) into the correct mssql config format.
 * 
 * @param {Object} config - Connection configuration object
 * @returns {Promise<boolean>} True if connection succeeds
 */
async function connect(config, existingConnectionId = null) {
  try {
    let finalConfig = buildMssqlConfig(config);

    console.log('--- DB CONNECTION ATTEMPT ---');
    console.log('Incoming port:', config.port, 'type:', typeof config.port);
    console.log('Final port:', finalConfig.port, 'type:', typeof finalConfig.port);

    const pool = new sql.ConnectionPool(finalConfig);
    await pool.connect();
    
    const connectionId = existingConnectionId || crypto.randomUUID();
    
    if (activePools.has(connectionId)) {
       const oldSession = activePools.get(connectionId);
       oldSession.pool.close().catch(e => {});
    }
    
    activePools.set(connectionId, {
      pool: pool,
      config: finalConfig,
      originalConfig: config,
      lastAccessed: Date.now()
    });
    
    return connectionId;
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
}

async function disconnect(connectionId) {
  const session = activePools.get(connectionId);
  if (session && session.pool) {
    await session.pool.close().catch(e => {});
    activePools.delete(connectionId);
  }
}

async function listDatabases(connectionId) {
  const pool = getPool(connectionId);
  if (!pool) throw new Error('Not connected to database');
  try {
    const result = await pool.request().query(`
      SELECT name FROM sys.databases 
      WHERE database_id > 4 
      ORDER BY name
    `);
    return result.recordset.map(row => row.name);
  } catch (err) {
    console.error('Failed to list databases:', err);
    throw err;
  }
}

async function getCurrentDatabase(connectionId) {
  const pool = getPool(connectionId);
  if (!pool) return null;
  try {
    const result = await pool.request().query('SELECT DB_NAME() AS current_db');
    return result.recordset[0]?.current_db || null;
  } catch (err) {
    console.error('Failed to get current database name:', err);
    return null;
  }
}

async function switchDatabase(connectionId, dbName) {
  const session = activePools.get(connectionId);
  if (!session) throw new Error('No active database connection found');
  
  // Re-connect using the original raw config with database overridden
  // connect() → buildMssqlConfig() ensures port is always a number
  const newConfig = { ...session.originalConfig, database: dbName };
  try {
    await connect(newConfig, connectionId);
    return true;
  } catch (err) {
    console.error('Failed to switch database:', err);
    throw err;
  }
}

/**
 * Retrieves the complete database schema structure including tables, columns, constraints, and foreign keys.
 * Uses a parallel execution strategy across 6 metadata queries for optimal performance.
 * Also performs an implicit foreign key inference pass based on naming conventions (e.g. UserId -> Id).
 * 
 * @returns {Promise<Object>} The structured schema object { tables, foreignKeys, primaryKeys, indices }
 */
async function getSchema(idOrPool) {
  const pool = resolvePool(idOrPool);
  if (!pool) throw new Error('Not connected to database');
  
  try {
    const [tablesRes, columnsRes, pkRes, fkRes, indexesRes, countRes] = await Promise.all([
      // 1. Tables
      pool.request().query(`
        SELECT 
          SCHEMA_NAME(t.schema_id) AS TABLE_SCHEMA, 
          t.name AS TABLE_NAME,
          t.create_date,
          t.modify_date
        FROM sys.tables t
      `),
      // 2. Columns
      pool.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, 
               CHARACTER_MAXIMUM_LENGTH, COLUMN_DEFAULT, ORDINAL_POSITION 
        FROM INFORMATION_SCHEMA.COLUMNS 
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `),
      // 3. Primary Keys
      pool.request().query(`
        SELECT tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.COLUMN_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      `),
      // 4. Foreign Keys
      pool.request().query(`
        SELECT fk.name AS constraint_name, 
               SCHEMA_NAME(tp.schema_id) AS parent_schema, tp.name AS parent_table, cp.name AS parent_column, 
               SCHEMA_NAME(tr.schema_id) AS referenced_schema, tr.name AS referenced_table, cr.name AS referenced_column 
        FROM sys.foreign_keys fk 
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id 
        JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id 
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id 
        JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id 
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      `),
      // 5. Indexes
      pool.request().query(`
        SELECT SCHEMA_NAME(t.schema_id) AS table_schema, t.name AS table_name, 
               i.name AS index_name, i.type_desc, i.is_unique, c.name AS column_name 
        FROM sys.indexes i 
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id 
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id 
        JOIN sys.tables t ON i.object_id = t.object_id 
        WHERE i.name IS NOT NULL
      `),
      // 6. Row Counts
      pool.request().query(`
        SELECT SCHEMA_NAME(t.schema_id) AS table_schema, t.name AS table_name, SUM(p.rows) AS row_count 
        FROM sys.tables t 
        JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1) 
        GROUP BY t.schema_id, t.name
      `)
    ]);

    // Assemble the data
    const schemaMap = {};
    const foreignKeys = fkRes.recordset.map(fk => ({
      constraintName: fk.constraint_name,
      parentSchema: fk.parent_schema,
      parentTable: fk.parent_table,
      parentColumn: fk.parent_column,
      referencedSchema: fk.referenced_schema,
      referencedTable: fk.referenced_table,
      referencedColumn: fk.referenced_column
    }));

    tablesRes.recordset.forEach(t => {
      const key = `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`;
      schemaMap[key] = {
        schema: t.TABLE_SCHEMA,
        name: t.TABLE_NAME,
        createDate: t.create_date,
        modifyDate: t.modify_date,
        rowCount: 0,
        columns: [],
        primaryKeys: [],
        foreignKeys: [],
        indexes: []
      };
    });

    countRes.recordset.forEach(c => {
        const key = `${c.table_schema}.${c.table_name}`;
        if (schemaMap[key]) {
            schemaMap[key].rowCount = c.row_count;
        }
    });

    pkRes.recordset.forEach(pk => {
      const key = `${pk.TABLE_SCHEMA}.${pk.TABLE_NAME}`;
      if (schemaMap[key]) {
        schemaMap[key].primaryKeys.push(pk.COLUMN_NAME);
      }
    });

    foreignKeys.forEach(fk => {
      const parentKey = `${fk.parentSchema}.${fk.parentTable}`;
      if (schemaMap[parentKey]) {
        schemaMap[parentKey].foreignKeys.push({
          constraintName: fk.constraintName,
          column: fk.parentColumn,
          referencedSchema: fk.referencedSchema,
          referencedTable: fk.referencedTable,
          referencedColumn: fk.referencedColumn
        });
      }
    });

    indexesRes.recordset.forEach(idx => {
      const key = `${idx.table_schema}.${idx.table_name}`;
      if (schemaMap[key]) {
        let indexEntry = schemaMap[key].indexes.find(i => i.name === idx.index_name);
        if (!indexEntry) {
          indexEntry = { name: idx.index_name, type: idx.type_desc, isUnique: idx.is_unique, columns: [] };
          schemaMap[key].indexes.push(indexEntry);
        }
        indexEntry.columns.push(idx.column_name);
      }
    });

    columnsRes.recordset.forEach(c => {
      const key = `${c.TABLE_SCHEMA}.${c.TABLE_NAME}`;
      if (schemaMap[key]) {
        const isPk = schemaMap[key].primaryKeys.includes(c.COLUMN_NAME);
        const isFk = schemaMap[key].foreignKeys.some(fk => fk.column === c.COLUMN_NAME);
        
        schemaMap[key].columns.push({
          name: c.COLUMN_NAME,
          dataType: c.DATA_TYPE,
          isNullable: c.IS_NULLABLE === 'YES',
          maxLength: c.CHARACTER_MAXIMUM_LENGTH,
          defaultValue: c.COLUMN_DEFAULT,
          ordinal: c.ORDINAL_POSITION,
          isPrimaryKey: isPk,
          isForeignKey: isFk
        });
      }
    });

    // --- Infer Implicit Foreign Keys ---
    const allTables = Object.values(schemaMap);
    allTables.forEach(t => {
      t.columns.forEach(c => {
        if (c.isForeignKey || c.isPrimaryKey) return;
        
        const colName = c.name;
        if (colName.toLowerCase().endsWith('id') && colName.length > 2) {
          const targetBase = colName.substring(0, colName.length - 2);
          const targetBaseLower = targetBase.toLowerCase();
          
          // Prevent self-referencing in inference to avoid noise
          if (targetBaseLower === t.name.toLowerCase() || targetBaseLower + 's' === t.name.toLowerCase()) return;
          
          const targetTable = allTables.find(potential => {
             const pName = potential.name.toLowerCase();
             return pName === targetBaseLower || 
                    pName === targetBaseLower + 's' || 
                    pName === targetBaseLower + 'es' ||
                    (targetBaseLower.endsWith('y') && pName === targetBaseLower.slice(0, -1) + 'ies');
          });
          
          if (targetTable) {
             const hasMatchingPK = targetTable.primaryKeys.some(pk => {
                 const pkLower = pk.toLowerCase();
                 return pkLower === 'id' || pkLower === targetBaseLower + 'id' || pkLower === colName.toLowerCase();
             });
             const hasIdCol = targetTable.columns.some(tc => tc.name.toLowerCase() === 'id' || tc.name.toLowerCase() === colName.toLowerCase());
             
             if (hasMatchingPK || hasIdCol) {
                 const targetColObj = hasMatchingPK 
                    ? targetTable.columns.find(tc => targetTable.primaryKeys.includes(tc.name) && (tc.name.toLowerCase() === 'id' || tc.name.toLowerCase() === targetBaseLower + 'id' || tc.name.toLowerCase() === colName.toLowerCase()))
                    : targetTable.columns.find(tc => tc.name.toLowerCase() === 'id' || tc.name.toLowerCase() === colName.toLowerCase());
                    
                 if (targetColObj) {
                     const targetColName = targetColObj.name;
                     const constraintName = `Implicit_FK_${t.name}_${colName}_${targetTable.name}`;
                     
                     foreignKeys.push({
                         constraintName,
                         parentSchema: t.schema,
                         parentTable: t.name,
                         parentColumn: colName,
                         referencedSchema: targetTable.schema,
                         referencedTable: targetTable.name,
                         referencedColumn: targetColName,
                         isImplicit: true
                     });
                     
                     t.foreignKeys.push({
                         constraintName,
                         column: colName,
                         referencedSchema: targetTable.schema,
                         referencedTable: targetTable.name,
                         referencedColumn: targetColName,
                         isImplicit: true
                     });
                     
                     c.isForeignKey = true;
                 }
             }
          }
        }
      });
    });
    // --- End Inference ---

    return {
      tables: allTables,
      foreignKeys
    };

  } catch (err) {
    console.error('Failed to get schema:', err);
    throw err;
  }
}

async function getTableData(connectionId, schema, name, page = 1, size = 50) {
  const pool = getPool(connectionId);
  if (!pool) throw new Error('Not connected to database');
  try {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.max(1, Math.min(5000, parseInt(size) || 50));
    const offset = (pageNum - 1) * pageSize;
    const sSchema = `[${schema}]`;
    const sName = `[${name}]`;
    
    const [dataResult, countResult] = await Promise.all([
      pool.request().query(`
        SELECT TOP ${pageSize} * FROM (
          SELECT *, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) as _rn 
          FROM ${sSchema}.${sName}
        ) sub 
        WHERE _rn > ${offset}
      `),
      pool.request()
        .input('schema', sql.NVarChar, schema)
        .input('name', sql.NVarChar, name)
        .query(`
          SELECT ISNULL(SUM(p.rows), 0) AS total
          FROM sys.partitions p
          JOIN sys.tables t ON p.object_id = t.object_id
          JOIN sys.schemas s ON t.schema_id = s.schema_id
          WHERE s.name = @schema AND t.name = @name
            AND p.index_id IN (0, 1)
        `)
    ]);
    
    const rows = dataResult.recordset.map(row => {
      const { _rn, ...rest } = row;
      return rest;
    });
    
    let columns = Object.keys(dataResult.recordset.columns || {}).filter(c => c !== '_rn');
    if (columns.length === 0 && rows.length > 0) {
      columns = Object.keys(rows[0]).filter(k => k !== '_rn');
    }

    const totalRows = countResult.recordset[0]?.total ?? rows.length;
    const totalPages = Math.ceil(totalRows / pageSize) || 1;

    return { rows, columns, page: pageNum, size: pageSize, totalRows, totalPages };
  } catch (err) {
    console.error(`Failed to get data for ${schema}.${name}:`, err);
    throw err;
  }
}

async function getTableCount(connectionId, schema, name) {
  const pool = getPool(connectionId);
  if (!pool) throw new Error('Not connected to database');
  try {
    const sSchema = `[${schema}]`;
    const sName = `[${name}]`;
    const result = await pool.request().query(`SELECT COUNT(*) as count FROM ${sSchema}.${sName}`);
    return result.recordset[0].count;
  } catch (err) {
    console.error(`Failed to get count for ${schema}.${name}:`, err);
    throw err;
  }
}

async function getStoredProcedures(idOrPool) {
  const pool = resolvePool(idOrPool);
  if (!pool) throw new Error('Not connected to database');
  try {
    const result = await pool.request().query(`
      SELECT 
        s.name AS schema_name, 
        p.name AS sp_name,
        p.create_date,
        p.modify_date,
        OBJECT_DEFINITION(p.object_id) AS definition
      FROM sys.procedures p
      JOIN sys.schemas s ON p.schema_id = s.schema_id
      ORDER BY s.name, p.name
    `);
    return result.recordset;
  } catch (err) {
    console.error('Failed to get stored procedures:', err);
    throw err;
  }
}

/**
 * Performs a dry-run execution of a stored procedure to determine its required parameters 
 * and shape of its output result set(s). Uses fmtonly or set noexec where possible to 
 * analyze without mutating data.
 * 
 * @param {string} schema - The schema of the stored procedure (e.g. dbo)
 * @param {string} name - The name of the stored procedure
 * @returns {Promise<Object>} Parameters, output schema, and raw SQL definition
 */
async function analyzeStoredProcedure(connectionId, schema, name) {
  const pool = getPool(connectionId);
  if (!pool) throw new Error('Not connected to database');
  try {
    const fullName = `[${schema}].[${name}]`;
    
    const paramsRes = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('name', sql.NVarChar, name)
      .query(`
        SELECT 
          p.name AS ParameterName, 
          t.name AS DataType, 
          p.max_length AS MaxLength, 
          p.is_output AS IsOutput
        FROM sys.parameters p
        JOIN sys.procedures pr ON p.object_id = pr.object_id
        JOIN sys.schemas s ON pr.schema_id = s.schema_id
        JOIN sys.types t ON p.user_type_id = t.user_type_id
        WHERE s.name = @schema AND pr.name = @name
        ORDER BY p.parameter_id
      `);

    const defRes = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('name', sql.NVarChar, name)
      .query(`
        SELECT 
          OBJECT_DEFINITION(p.object_id) AS definition,
          p.create_date,
          p.modify_date
        FROM sys.procedures p
        JOIN sys.schemas s ON p.schema_id = s.schema_id
        WHERE s.name = @schema AND p.name = @name
      `);

    let outputColumns = [];
    try {
      const outputRes = await pool.request().query(`
        SELECT name, system_type_name, is_nullable 
        FROM sys.dm_exec_describe_first_result_set(N'EXEC ${fullName}', NULL, 0)
        WHERE name IS NOT NULL
      `);
      outputColumns = outputRes.recordset;
    } catch (e) {
      console.warn('Could not determine output schema via dry-run for', fullName, e.message);
    }

    // Dependencies: What does this SP depend on?
    const dependsOnRes = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('name', sql.NVarChar, name)
      .query(`
        SELECT 
          ISNULL(referenced_schema_name, 'dbo') AS schema_name,
          referenced_entity_name AS entity_name,
          referenced_class_desc AS type
        FROM sys.sql_expression_dependencies d
        JOIN sys.objects o ON d.referencing_id = o.object_id
        JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE s.name = @schema AND o.name = @name
      `);

    // Dependencies: What depends on this SP?
    const referencedByRes = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('name', sql.NVarChar, name)
      .query(`
        SELECT 
          s.name AS schema_name,
          o.name AS entity_name,
          o.type_desc AS type
        FROM sys.sql_expression_dependencies d
        JOIN sys.objects o ON d.referencing_id = o.object_id
        JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE d.referenced_entity_name = @name
          AND ISNULL(d.referenced_schema_name, 'dbo') = @schema
      `);

    return {
      parameters: paramsRes.recordset,
      definition: defRes.recordset[0]?.definition || '',
      createDate: defRes.recordset[0]?.create_date || null,
      modifyDate: defRes.recordset[0]?.modify_date || null,
      outputColumns: outputColumns,
      dependsOn: dependsOnRes.recordset,
      referencedBy: referencedByRes.recordset
    };

  } catch (err) {
    console.error('Failed to analyze SP:', err);
    throw err;
  }
}

/**
 * Identifies database objects (Views, other SPs, Triggers) that depend on a specific table.
 * Helpful for understanding the blast radius before modifying a table's schema.
 * 
 * @param {string} schema - The schema of the table
 * @param {string} name - The name of the table to find dependencies for
 * @returns {Promise<Array>} List of dependent objects with their schema and type
 */
async function getTableDependencies(connectionId, schema, name) {
  const pool = getPool(connectionId);
  if (!pool) throw new Error('Not connected to database');
  try {
    const result = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('name', sql.NVarChar, name)
      .query(`
        SELECT 
          s.name AS schema_name,
          o.name AS entity_name,
          o.type_desc AS type
        FROM sys.sql_expression_dependencies d
        JOIN sys.objects o ON d.referencing_id = o.object_id
        JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE d.referenced_entity_name = @name
          AND ISNULL(d.referenced_schema_name, 'dbo') = @schema
      `);
    return result.recordset;
  } catch (err) {
    console.error(`Failed to get dependencies for table ${schema}.${name}:`, err);
    throw err;
  }
}

/**
 * Creates a temporary connection to another database to fetch its full schema and SPs.
 * Used for database comparison.
 */
async function getFullSchemaForDatabase(connectionId, dbName) {
  const session = activePools.get(connectionId);
  const currentConfig = session ? session.originalConfig : null;
  if (!currentConfig) throw new Error('No active connection config');
  
  const tempConfig = buildMssqlConfig(currentConfig, dbName);

  const tempPool = new sql.ConnectionPool(tempConfig);
  try {
    await tempPool.connect();
    const schema = await getSchema(tempPool);
    const sps = await getStoredProcedures(tempPool);
    return { schema, sps };
  } catch (err) {
    console.error(`Failed to get full schema for DB ${dbName}:`, err);
    throw err;
  } finally {
    try {
      await tempPool.close();
    } catch (e) {
      console.error('Error closing temp pool', e);
    }
  }
}

/**
 * Gets the actual SQL definition of a stored procedure.
 */
async function getSpDefinition(idOrPool, schema, name) {
  let pool = resolvePool(idOrPool);
  let s = schema;
  let n = name;

  // Flexibility if called with (schema, name, pool)
  if (!pool && typeof name === 'object' && name !== null) {
    pool = resolvePool(name);
    s = idOrPool;
    n = schema;
  }

  if (!pool) throw new Error('Not connected to database');
  
  try {
    const result = await pool.request()
      .input('schema', sql.NVarChar, s)
      .input('name', sql.NVarChar, n)
      .query(`
        SELECT OBJECT_DEFINITION(OBJECT_ID(@schema + '.' + @name)) AS definition
      `);
    return result.recordset[0]?.definition || '';
  } catch (err) {
    console.error(`Failed to fetch SP definition for ${s}.${n}:`, err);
    throw err;
  }
}

/**
 * Gets the actual SQL definition of a stored procedure from a specific database on the current session server.
 */
async function getSpDefinitionForDatabase(connectionId, dbName, schema, name) {
  const session = activePools.get(connectionId);
  const currentConfig = session ? session.originalConfig : null;
  if (!currentConfig) throw new Error('No active connection config');
  
  return await getSpDefinitionFromConfig(currentConfig, schema, name, dbName);
}

/**
 * Lists databases for a given connection configuration (supports connection string or manual config).
 */
async function listDatabasesFromConfig(config) {
  const finalConfig = buildMssqlConfig(config);
  const tempPool = new sql.ConnectionPool(finalConfig);
  try {
    await tempPool.connect();
    const [dbRes, currDbRes] = await Promise.all([
      tempPool.request().query(`
        SELECT name FROM sys.databases 
        WHERE database_id > 4 
        ORDER BY name
      `),
      tempPool.request().query('SELECT DB_NAME() AS current_db').catch(() => ({ recordset: [] }))
    ]);
    const databases = dbRes.recordset.map(row => row.name);
    const currentDatabase = currDbRes.recordset[0]?.current_db || null;
    return { databases, currentDatabase };
  } catch (err) {
    console.error('Failed to list databases from config:', err);
    throw err;
  } finally {
    try {
      await tempPool.close();
    } catch (e) {
      console.error('Error closing temp pool', e);
    }
  }
}

/**
 * Retrieves full schema and SPs from a given connection configuration.
 */
async function getFullSchemaFromConfig(config, dbOverride) {
  const finalConfig = buildMssqlConfig(config, dbOverride);
  const tempPool = new sql.ConnectionPool(finalConfig);
  try {
    await tempPool.connect();
    const schema = await getSchema(tempPool);
    const sps = await getStoredProcedures(tempPool);
    const currDbRes = await tempPool.request().query('SELECT DB_NAME() AS current_db').catch(() => ({ recordset: [] }));
    const currentDatabase = currDbRes.recordset[0]?.current_db || null;
    return { schema, sps, currentDatabase };
  } catch (err) {
    console.error('Failed to get full schema from config:', err);
    throw err;
  } finally {
    try {
      await tempPool.close();
    } catch (e) {
      console.error('Error closing temp pool', e);
    }
  }
}

/**
 * Gets the actual SQL definition of a stored procedure from a given connection configuration.
 */
async function getSpDefinitionFromConfig(config, schema, name, dbOverride) {
  const finalConfig = buildMssqlConfig(config, dbOverride);
  const tempPool = new sql.ConnectionPool(finalConfig);
  try {
    await tempPool.connect();
    return await getSpDefinition(tempPool, schema, name);
  } catch (err) {
    console.error(`Failed to get SP definition from config for ${schema}.${name}:`, err);
    throw err;
  } finally {
    try {
      await tempPool.close();
    } catch (e) {
      console.error('Error closing temp pool', e);
    }
  }
}

module.exports = {
  connect,
  disconnect,
  listDatabases,
  switchDatabase,
  getCurrentDatabase,
  getSchema,
  getTableData,
  getTableCount,
  getTableDependencies,
  getStoredProcedures,
  analyzeStoredProcedure,
  getFullSchemaForDatabase,
  getSpDefinition,
  getSpDefinitionForDatabase,
  listDatabasesFromConfig,
  getFullSchemaFromConfig,
  getSpDefinitionFromConfig,
  buildMssqlConfig,
  getConfig: getConfig
};
