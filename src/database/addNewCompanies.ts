import { Pool } from 'pg';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

async function addNewCompanies() {
  const client = await pool.connect();

  try {
    console.log('Adding new companies to database...\n');

    // Read JSON file
    console.log('Reading companies.json...');
    const jsonPath = path.join(__dirname, '../data/companies.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    const companies = JSON.parse(jsonData);
    console.log(`Found ${companies.length} companies in file\n`);

    // Get existing companies count
    const countResult = await client.query('SELECT COUNT(*) FROM companies');
    const existingCount = parseInt(countResult.rows[0].count);
    console.log(`Existing companies in DB: ${existingCount}\n`);

    // Import only NEW companies
    console.log('Adding new companies...');
    let successCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < companies.length; i++) {
      try {
        const data = companies[i];

        // Check if company already exists by name
        const existingCompany = await client.query(
          'SELECT id FROM companies WHERE company_name = $1',
          [data.company_name]
        );

        if (existingCompany.rows.length > 0) {
          skippedCount++;
          continue;
        }

        // Clean data functions
        const cleanRating = (val: any) => {
          if (!val || val === 'N/A' || val === 'n/a' || val === 0) return null;
          const num = parseFloat(val);
          return isNaN(num) ? null : num;
        };

        const cleanInt = (val: any) => {
          if (!val || val === 'N/A' || val === 'n/a') return 0;
          const num = parseInt(val);
          return isNaN(num) ? 0 : num;
        };

        const cleanString = (val: any, maxLength?: number) => {
          if (!val || val === 'N/A' || val === 'n/a' || val === '') return null;
          const str = String(val).trim();
          if (maxLength && str.length > maxLength) {
            return str.substring(0, maxLength);
          }
          return str;
        };

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);

        // Insert company
        await client.query(`
          INSERT INTO companies (
            company_name, tagline, description, rating, reviews_count, verified_hires,
            phone, email, address, website,
            license_number, verified_business, responds_quickly, hired_on_platform,
            family_owned, eco_friendly, locally_owned, offers_custom_work,
            provides_3d_visualization, professional_category, budget_range,
            years_in_business, employees_count, languages,
            services_offered, specialties,
            service_areas, service_cities, service_zip_codes,
            awards, certifications,
            images,
            featured_reviewer_name, featured_review_text, featured_review_rating,
            update_token, token_expires_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37
          )
        `, [
          cleanString(data.company_name, 500),
          cleanString(data.tagline),
          cleanString(data.description),
          cleanRating(data.rating),
          cleanInt(data.reviews_count),
          cleanInt(data.verified_hires),
          cleanString(data.phone, 50),
          cleanString(data.email, 255),
          cleanString(data.address),
          cleanString(data.website, 500),
          cleanString(data.license_number, 100),
          data.verified_business || false,
          data.responds_quickly || false,
          data.hired_on_platform || false,
          data.family_owned || false,
          data.eco_friendly || false,
          data.locally_owned || false,
          data.offers_custom_work || false,
          data.provides_3d_visualization || false,
          cleanString(data.professional_category, 255),
          cleanString(data.budget_range, 100),
          cleanInt(data.years_in_business),
          cleanString(data.employees_count, 50),
          data.languages || null,
          data.services_offered && data.services_offered.length > 0 ? data.services_offered : null,
          data.specialties && data.specialties.length > 0 ? data.specialties : null,
          cleanString(data.service_areas),
          data.service_cities && data.service_cities.length > 0 ? data.service_cities : null,
          data.service_zip_codes && data.service_zip_codes.length > 0 ? data.service_zip_codes : null,
          data.awards && data.awards.length > 0 ? data.awards : null,
          data.certifications && data.certifications.length > 0 ? data.certifications : null,
          [data.image_url, data.image_url_2, data.image_url_3].filter(url => url && url.length > 0),
          cleanString(data.featured_reviewer_name),
          cleanString(data.featured_review_text),
          cleanRating(data.featured_review_rating),
          token,
          expiresAt
        ]);

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`  ✓ Added ${successCount} new companies...`);
        }
      } catch (error) {
        console.error(`  ✗ Error adding company ${i + 1}:`, error);
      }
    }

    console.log(`\nSuccessfully added ${successCount} new companies!`);
    console.log(`Skipped ${skippedCount} existing companies\n`);

    // Verify
    const finalResult = await client.query('SELECT COUNT(*) FROM companies');
    console.log(`Total companies in database: ${finalResult.rows[0].count}\n`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addNewCompanies()
  .then(() => {
    console.log('New companies added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
