
import pool from '../config/database';

async function checkColumn() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'user_id'");
        console.log('User ID column exists:', res.rows.length > 0);
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
checkColumn();
