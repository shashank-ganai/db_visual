const sql = require('mssql');
const fs = require('fs');

const config = {
  user: 'SmartOne',
  password: '891011',
  server: '103.110.164.69',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const spNames = [
  'usp_UpsertTeachingLog',
  'usp_GetTeachingLogByID',
  'usp_GetTeachingLogByFilters',
  'usp_GetTeachingLogByFilters_V2',
  'usp_GetDaywiseTeachingLogCounts'
];

async function run() {
  let pool;
  let output = '';
  try {
    pool = await sql.connect(config);
    output += 'Connected to SQL Server.\n';

    const dbResult = await pool.request().query('SELECT name FROM sys.databases WHERE state = 0');
    const databases = dbResult.recordset.map(row => row.name);
    
    for (const dbName of databases) {
      try {
        const query = `
          SELECT 
            '${dbName}' as db,
            SCHEMA_NAME(o.schema_id) as schema_name, 
            o.name, 
            m.definition 
          FROM [${dbName}].sys.sql_modules m 
          JOIN [${dbName}].sys.objects o ON m.object_id = o.object_id 
          WHERE o.name IN ('${spNames.join("','")}')
        `;
        const res = await pool.request().query(query);
        for (const row of res.recordset) {
          output += `\n======================================================\n`;
          output += `Found ${row.name} in Database: ${row.db}, Schema: ${row.schema_name}\n`;
          output += `======================================================\n`;
          output += row.definition + '\n';
        }
      } catch (err) {
        // Skip
      }
    }
    fs.writeFileSync('sps_output_utf8.txt', output, 'utf8');
  } catch (err) {
    fs.writeFileSync('sps_output_utf8.txt', err.toString(), 'utf8');
  } finally {
    if (pool) pool.close();
  }
}

run();
