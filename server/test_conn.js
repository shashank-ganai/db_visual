const sql = require('mssql');

const connStr = 'Provider=SQLOLEDB.1;Password=891011;Persist Security Info=True;User ID=SmartOne;Data Source=103.110.164.69,1433\\sqlexpress';

async function test() {
  try {
    const pool = new sql.ConnectionPool(connStr);
    await pool.connect();
    console.log('Connected!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
