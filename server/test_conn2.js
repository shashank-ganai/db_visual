const sql = require('mssql');

const config = {
  user: 'SmartOne',
  password: '891011',
  server: '103.110.164.69', // Just IP
  port: 1433,               // Explicit port
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function test() {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('Connected!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
