
import pool from '../config/database';

async function verify() {
    try {
        const res = await pool.query("SELECT id, company_name, user_id, rating FROM companies WHERE company_name = 'Test Corp'");
        console.log('Results:', JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
verify();
