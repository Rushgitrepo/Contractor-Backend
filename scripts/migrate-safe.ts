import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'contractor_app',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    }
};

const pool = new Pool(config.database);

async function migrateSafe() {
    try {
        console.log('Reading schema.sql...');
        const schemaPath = path.join(__dirname, '../src/database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Filter out destructive DROP commands
        const validLines = schemaSql.split('\n').filter(line => {
            const trimmed = line.trim();
            const isDropTable = /^DROP\s+TABLE/i.test(trimmed);
            const isDropTrigger = /^DROP\s+TRIGGER/i.test(trimmed);
            const isDropFunction = /^DROP\s+FUNCTION/i.test(trimmed);

            if (isDropTable) {
                return false;
            }
            return true;
        });

        let safeSql = validLines.join('\n');

        // Add IF NOT EXISTS to CREATE TABLE
        // We use a specific regex that looks for "CREATE TABLE" not followed by "IF NOT EXISTS"
        safeSql = safeSql.replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ');

        // Add IF NOT EXISTS to CREATE INDEX
        safeSql = safeSql.replace(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS ');

        // Write to a temporary file for inspection/debugging
        const tempFile = path.join(__dirname, 'temp_safe_migration.sql');
        fs.writeFileSync(tempFile, safeSql);
        console.log(`Generated safe SQL at ${tempFile}`);

        console.log('Executing migration...');
        await pool.query(safeSql);

        console.log('✅ Migration successful!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        // Print the first error detail if available
        if (err && (err as any).position) {
            console.error('Error position:', (err as any).position);
        }
    } finally {
        await pool.end();
    }
}

migrateSafe();
