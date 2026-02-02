import { Pool } from 'pg';
import { config } from '../config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

async function setupContractorUpdate() {
  const client = await pool.connect();
  
  try {
    console.log('Setting up contractor update system...\n');
    
    // Step 1: Add token columns
    console.log('Adding token columns...');
    await client.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS update_token VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_updated_by_contractor TIMESTAMP;
      
      CREATE INDEX IF NOT EXISTS idx_companies_token ON companies(update_token);
    `);
    console.log('Columns added\n');
    
    // Step 2: Generate tokens for all contractors
    console.log('Generating unique tokens...');
    const result = await client.query('SELECT id, company_name, email FROM companies ORDER BY id');
    
    const contractors = [];
    
    for (const company of result.rows) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry
      
      await client.query(
        'UPDATE companies SET update_token = $1, token_expires_at = $2 WHERE id = $3',
        [token, expiresAt, company.id]
      );
      
      contractors.push({
        id: company.id,
        company_name: company.company_name,
        email: company.email || 'no-email@example.com',
        update_link: `http://localhost:3000/contractor/update/${token}`,
        token: token,
        expires_at: expiresAt.toISOString()
      });
    }
    
    console.log(`Generated ${contractors.length} tokens\n`);
    
    // Step 3: Export for n8n
    console.log('Exporting data for n8n...');
    const outputPath = path.join(process.cwd(), 'contractor-update-links.json');
    fs.writeFileSync(outputPath, JSON.stringify(contractors, null, 2));
    
    const csvPath = path.join(process.cwd(), 'contractor-update-links.csv');
    const csvHeader = 'ID,Company Name,Email,Update Link\n';
    const csvRows = contractors.map(c => 
      `${c.id},"${c.company_name}","${c.email}","${c.update_link}"`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    
    console.log(`Exported to: ${outputPath}`);
    console.log(`CSV exported to: ${csvPath}\n`);
    
    console.log('Sample links (first 3):');
    contractors.slice(0, 3).forEach(c => {
      console.log(`\n  ${c.company_name}`);
      console.log(`  Email: ${c.email}`);
      console.log(`  Link: ${c.update_link}`);
    });
    
    console.log('\n\nNEXT STEPS:');
    console.log('1. Use contractor-update-links.json in your n8n workflow');
    console.log('2. n8n will send emails with the update_link for each contractor');
    console.log('3. Contractors click link → update their info → database updates automatically');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupContractorUpdate()
  .then(() => {
    console.log('\nSetup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
