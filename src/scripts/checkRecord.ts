
import pool from '../config/database';

async function checkRecord() {
    try {
        const res = await pool.query("SELECT * FROM companies WHERE company_name = 'Test Corp'");
        console.log('Record found:', JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
checkRecord();
