
require('dotenv').config();
const { Client } = require('pg');

const updateStatusConstraint = async () => {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'ali980',
        database: process.env.DB_NAME || 'contractorlist',
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Migrate existing data to conform to new 5 statuses
        // Map: 'In Progress' -> 'Active', 'On Track' -> 'Active', 'Delayed' -> 'On Hold', 'Cancelled' -> 'On Hold'
        // Allowed: 'Planning', 'Bidding', 'Active', 'Completed', 'On Hold'

        console.log('Migrating old statuses...');
        await client.query(`UPDATE gc_projects SET status = 'Active' WHERE status IN ('In Progress', 'On Track')`);
        await client.query(`UPDATE gc_projects SET status = 'On Hold' WHERE status IN ('Delayed', 'Cancelled')`);
        // Ensure any others default to Planning if somehow invalid
        await client.query(`UPDATE gc_projects SET status = 'Planning' WHERE status NOT IN ('Planning', 'Bidding', 'Active', 'Completed', 'On Hold')`);
        console.log('Data migration complete');

        // 2. Drop the existing constraint
        try {
            await client.query(`ALTER TABLE gc_projects DROP CONSTRAINT IF EXISTS gc_projects_status_check`);
            console.log('Dropped existing status check constraint');
        } catch (e) {
            console.log('Error dropping constraint (ignorable):', e.message);
        }

        // 3. Add new constraint with ONLY the 5 allowed statuses
        await client.query(`
      ALTER TABLE gc_projects 
      ADD CONSTRAINT gc_projects_status_check 
      CHECK (status IN ('Planning', 'Bidding', 'Active', 'Completed', 'On Hold'))
    `);
        console.log('Added new status check constraint');

        await client.end();
    } catch (error) {
        console.error('Error updating constraint:', error);
        process.exit(1);
    }
};

updateStatusConstraint();
