
import pool from '../config/database';

const listUsers = async () => {
    try {
        const res = await pool.query('SELECT email, role FROM users LIMIT 10');
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

listUsers();
