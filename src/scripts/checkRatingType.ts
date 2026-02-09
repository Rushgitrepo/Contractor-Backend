
import pool from '../config/database';

async function checkDataType() {
    try {
        const res = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'rating'");
        console.log('Rating data type:', res.rows[0].data_type);
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
checkDataType();
