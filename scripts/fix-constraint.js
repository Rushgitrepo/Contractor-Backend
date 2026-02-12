const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'contractorlist',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function fixConstraint() {
  try {
    console.log('Connecting to database...');
    
    // Drop old constraint
    console.log('Dropping old constraint...');
    await pool.query('ALTER TABLE gc_projects DROP CONSTRAINT IF EXISTS gc_projects_status_check');
    
    // Add new constraint
    console.log('Adding new constraint...');
    await pool.query(`
      ALTER TABLE gc_projects ADD CONSTRAINT gc_projects_status_check 
      CHECK (status IN ('Planning', 'In Progress', 'Bidding', 'On Hold', 'Completed', 'Cancelled', 'Active'))
    `);
    
    // Verify
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'gc_projects'::regclass AND conname = 'gc_projects_status_check'
    `);
    
    console.log('✅ Constraint updated successfully!');
    console.log('New constraint:', result.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixConstraint();
