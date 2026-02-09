
import pool from '../config/database';

async function simulate() {
    try {
        const limit = 100;
        const res = await pool.query(`
            SELECT id, company_name, user_id, rating, professional_category 
            FROM companies 
            ORDER BY rating DESC NULLS LAST 
            LIMIT $1
        `, [limit]);

        const testCorp = res.rows.find(c => c.company_name === 'Test Corp');
        console.log('Test Corp in top 100:', !!testCorp);
        if (testCorp) {
            console.log('Test Corp Details:', testCorp);
        }

        const withUserId = res.rows.filter(c => c.user_id !== null);
        console.log('Companies with user_id in top 100:', withUserId.length);
        console.log('Sample with user_id:', withUserId.slice(0, 5));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
simulate();
