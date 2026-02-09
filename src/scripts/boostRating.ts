
import pool from '../config/database';

async function boostRating() {
    try {
        await pool.query("UPDATE companies SET rating = 5.0 WHERE company_name = 'Test Corp'");
        console.log('Rating boosted');
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
boostRating();
