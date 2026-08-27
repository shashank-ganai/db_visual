const sql = require('mssql');

const activePools = new Map();

function buildConfig(dbName) {
    return {
        user: 'SmartOne',
        password: '891011',
        server: '103.110.164.69',
        database: dbName,
        port: 1433,
        options: { encrypt: false, trustServerCertificate: true },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
    };
}

async function connect(config, connectionId) {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    
    if (activePools.has(connectionId)) {
       const oldSession = activePools.get(connectionId);
       oldSession.pool.close().catch(e => {});
    }
    
    activePools.set(connectionId, { pool, config });
}

async function switchDatabase(connectionId, dbName) {
    const session = activePools.get(connectionId);
    const newConfig = { ...session.config, database: dbName };
    await connect(newConfig, connectionId);
}

async function test() {
    const cid = 'test-id';
    await connect(buildConfig(''), cid);
    console.log('Connected to master');
    
    await switchDatabase(cid, 'SmartHomework');
    console.log('Switched to SmartHomework');
    
    const session = activePools.get(cid);
    const currentDbRes = await session.pool.request().query('SELECT DB_NAME() as db');
    console.log('Current DB:', currentDbRes.recordset[0].db);
    
    const schemaRes = await session.pool.request().query("SELECT count(*) as c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log('Tables fetched:', schemaRes.recordset[0].c);
    
    process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
