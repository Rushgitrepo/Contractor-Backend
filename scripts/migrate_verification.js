const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const migrate = async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../src/database/verificationSchemas.sql'), 'utf8');
    await pool.query(sql);
    console.log('Verification schema migrated successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
};

migrate();
