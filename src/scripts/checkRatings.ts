
import pool from '../config/database';

async function checkRatings() {
    try {
        const res = await pool.query("SELECT rating, COUNT(*) FROM companies GROUP BY rating ORDER BY rating DESC NULLS LAST LIMIT 20");
        console.log('Rating distribution:');
        console.table(res.rows);

        const testCorp = await pool.query("SELECT rating FROM companies WHERE company_name = 'Test Corp'");
        console.log('Test Corp Rating:', testCorp.rows[0]?.rating);

        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
checkRatings();
