
import pool from '../config/database';
import { hashPassword } from '../utils/password';

const createTestUser = async () => {
    const email = 'testworker@example.com';
    const pass = 'password123';
    const role = 'subcontractor';

    try {
        const hashed = await hashPassword(pass);
        const res = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password, role, is_verified) 
       VALUES ('Test', 'Worker', $1, $2, $3, true) 
       ON CONFLICT (email) DO UPDATE SET password = $2 RETURNING id, email`,
            [email, hashed, role]
        );
        console.log('Created/Updated Test User:', res.rows[0]);

        // Create profile if needed (minimal)
        await pool.query(
            `INSERT INTO sub_contractor_profiles (user_id, company_name, role) VALUES ($1, 'Test Corp', 'subcontractor') ON CONFLICT DO NOTHING`,
            [res.rows[0].id]
        );

        // Create company record for discovery
        await pool.query(
            `INSERT INTO companies (user_id, company_name, email, description, service_cities) 
         VALUES ($1, 'Test Corp', $2, 'A test company for chat verification', ARRAY['New York']) 
         ON CONFLICT (user_id) DO NOTHING`,
            [res.rows[0].id, email]
        );

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createTestUser();
