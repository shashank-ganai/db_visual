const sql = require('mssql');

async function test() {
    const configMaster = {
        user: 'SmartOne',
        password: '891011',
        server: '103.110.164.69',
        database: 'master',
        port: 1433,
        options: { encrypt: false, trustServerCertificate: true },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
    };
    
    const poolMaster = new sql.ConnectionPool(configMaster);
    await poolMaster.connect();
    
    let res = await poolMaster.request().query("SELECT count(*) as c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log('Master tables:', res.recordset[0].c);

    const configSmart = { ...configMaster, database: 'SmartHomework' };
    const poolSmart = new sql.ConnectionPool(configSmart);
    await poolSmart.connect();
    
    res = await poolSmart.request().query("SELECT count(*) as c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log('SmartHomework tables:', res.recordset[0].c);
    
    process.exit(0);
}
test().catch(console.error);
