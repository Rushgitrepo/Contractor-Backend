
import pool from '../config/database';

async function check() {
    try {
        const res = await pool.query("SELECT rating, COUNT(*) FROM companies WHERE rating > 5.0 GROUP BY rating ORDER BY rating DESC");
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
check();
