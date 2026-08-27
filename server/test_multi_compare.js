const assert = require('assert');
const db = require('./db');

async function runTests() {
  console.log('Testing buildMssqlConfig...');

  // Test 1: connectionString without override
  const cs1 = 'Server=server1;Database=db1;User Id=usr;Password=pwd;';
  const cfg1 = db.buildMssqlConfig({ connectionString: cs1 });
  assert.strictEqual(cfg1, cs1, 'Connection string should be preserved');

  // Test 2: connectionString with db override
  const cfg2 = db.buildMssqlConfig({ connectionString: cs1 }, 'db2');
  assert.ok(cfg2.includes('Database=db2'), 'Database should be overridden to db2 in connection string');

  // Test 3: raw string
  const cfg3 = db.buildMssqlConfig(cs1, 'db3');
  assert.ok(cfg3.includes('Database=db3'), 'Database should be overridden to db3 in raw string');

  // Test 4: manual structured config
  const manual = {
    server: 'sql.example.com\\SQLEXPRESS',
    port: '1433',
    database: 'initial_db',
    user: 'admin',
    password: 'secret'
  };
  const cfg4 = db.buildMssqlConfig(manual);
  assert.strictEqual(cfg4.server, 'sql.example.com');
  assert.strictEqual(cfg4.options.instanceName, 'SQLEXPRESS');
  assert.strictEqual(cfg4.port, 1433);
  assert.strictEqual(cfg4.database, 'initial_db');

  // Test 5: manual structured config with dbOverride
  const cfg5 = db.buildMssqlConfig(manual, 'overridden_db');
  assert.strictEqual(cfg5.database, 'overridden_db');

  console.log('✅ All buildMssqlConfig unit tests passed!');

  // Test 6: Verify exported functions exist
  assert.strictEqual(typeof db.listDatabasesFromConfig, 'function');
  assert.strictEqual(typeof db.getFullSchemaFromConfig, 'function');
  assert.strictEqual(typeof db.getSpDefinitionFromConfig, 'function');
  assert.strictEqual(typeof db.getSpDefinitionForDatabase, 'function');
  console.log('✅ All exported comparison helper methods exist!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
