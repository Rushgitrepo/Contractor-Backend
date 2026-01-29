
import pool from '../config/database';
import { hashPassword } from '../utils/password';

const users = [
    {
        email: 'homeowner@demo.com',
        role: 'client',
        firstName: 'Demo',
        lastName: 'Homeowner',
        profileTable: 'client_profiles',
        profileData: {
            project_type: 'Residential',
            budget_range: '$10k - $50k',
            timeline: 'Immediate',
            property_size: '2000 sqft',
            financing_status: 'Pre-approved',
            company_name: 'Homeowner Corp',
            property_address: '123 Home St',
            role: 'Homeowner',
            interests: ['Renovation'],
            goals: ['Renovate Kitchen']
        }
    },
    {
        email: 'pro@demo.com',
        role: 'general-contractor',
        firstName: 'Demo',
        lastName: 'GC',
        profileTable: 'general_contractor_profiles',
        profileData: {
            company_name: 'Demo GC Inc',
            company_size: '10-50',
            years_in_business: 10,
            project_size_range: '$100k - $1M',
            address: '456 Builder Ave',
            role: 'Owner',
            trades: ['General Contruction'],
            goals: ['Win more bids']
        }
    },
    {
        email: 'sub@demo.com',
        role: 'subcontractor',
        firstName: 'Demo',
        lastName: 'Sub',
        profileTable: 'sub_contractor_profiles',
        profileData: {
            company_name: 'Demo Sub LLC',
            company_size: '1-10',
            years_in_business: 5,
            service_area: 'Austin, TX',
            address: '789 Worker Ln',
            role: 'Manager',
            trades: ['Electrical', 'Plumbing'],
            goals: ['Find steady work']
        }
    },
    {
        email: 'vendor@demo.com',
        role: 'vendor',
        firstName: 'Demo',
        lastName: 'Vendor',
        profileTable: 'supplier_profiles',
        profileData: {
            company_name: 'Demo Supply Co',
            company_size: '50+',
            business_type: 'Distributor',
            years_in_business: 15,
            delivery_radius: 100,
            min_order_value: '$500',
            offer_credit_terms: true,
            address: '101 Warehouse Blvd',
            role: 'Sales Manager',
            product_categories: ['Lumber', 'Hardware'],
            goals: ['Expand client base']
        }
    }
];

const seed = async () => {
    try {
        console.log('🌱 Starting user seeding...');
        const hashedPassword = await hashPassword('password123');

        for (const user of users) {
            // Check if user exists
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);

            if (existingUser.rows.length > 0) {
                console.log(`⚠️ User ${user.email} already exists. Skipping.`);
                continue;
            }

            // Insert User
            const userRes = await pool.query(
                `INSERT INTO users (first_name, last_name, email, password, role, phone, is_verified) 
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
                [user.firstName, user.lastName, user.email, hashedPassword, user.role, '555-0100']
            );

            const userId = userRes.rows[0].id;

            // Insert Profile
            const keys = Object.keys(user.profileData);
            const values = Object.values(user.profileData);
            const columns = ['user_id', ...keys].join(', ');

            // Correct placeholders: $1 is userId, subsequent values start at $2
            const placeholders = ['$1', ...keys.map((_, i) => `$${i + 2}`)].join(', ');

            const query = `INSERT INTO ${user.profileTable} (${columns}) VALUES (${placeholders})`;

            await pool.query(query, [userId, ...values]);
            console.log(`✅ Created user: ${user.email}`);
        }

        console.log('✨ Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seed();
