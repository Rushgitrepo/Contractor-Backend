
import pool from '../config/database';

async function boost() {
    try {
        await pool.query("UPDATE companies SET rating = 9.99 WHERE company_name = 'Test Corp'");
        console.log('Test Corp boosted to top');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
boost();
