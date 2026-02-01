import fs from 'fs';
import path from 'path';
import pool from '../config/database';

const runMigration = async () => {
  try {
    console.log('Running database migrations...');

    // Core schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('Core schema applied');

    console.log('All migrations completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
