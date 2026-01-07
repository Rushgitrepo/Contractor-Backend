require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'contractorlist',
});

const importCompanies = async () => {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database: contractorlist');

    const dataPath = path.join(__dirname, '../src/data/companies.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const companies = JSON.parse(rawData);

    console.log(`Found ${companies.length} companies in JSON.`);

    // 0. Clear existing data
    console.log('Clearing existing companies...');
    await client.query('TRUNCATE table companies RESTART IDENTITY CASCADE');

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    // Track unique names to avoid duplicates within the JSON file itself
    const seenCompanies = new Set();

    for (const company of companies) {
      if (!company.company_name) continue;
      
      // Normalize name for checking duplicates (simple trim + lowercase)
      const normalizedName = company.company_name.trim().toLowerCase();
      if (seenCompanies.has(normalizedName)) {
        duplicateCount++;
        continue; 
      }
      seenCompanies.add(normalizedName);

      // Prepare data for single table insertion
      
      const insertCompanyQuery = `
        INSERT INTO companies (
          company_name, tagline, description, rating, reviews_count, verified_hires,
          phone, email, address, website, license_number, verified_business,
          responds_quickly, hired_on_platform, family_owned, eco_friendly, locally_owned,
          offers_custom_work, provides_3d_visualization, professional_category,
          budget_range, years_in_business, employees_count, languages,
          
          services_offered, specialties, service_areas, service_cities, service_zip_codes,
          certifications, awards, images,
          featured_reviewer_name, featured_review_text, featured_review_rating
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28, $29,
          $30, $31, $32,
          $33, $34, $35
        ) RETURNING id;
      `;

      // Aggregate images
      const images = [company.image_url, company.image_url_2, company.image_url_3].filter(url => url && url.length > 0);

      const values = [
        company.company_name,
        company.tagline,
        company.description,
        company.rating || 0,
        company.reviews_count || 0,
        company.verified_hires || 0,
        company.phone,
        company.email,
        company.address,
        company.website,
        company.license_number,
        company.verified_business || false,
        company.responds_quickly || false,
        company.hired_on_platform || false,
        company.family_owned || false,
        company.eco_friendly || false,
        company.locally_owned || false,
        company.offers_custom_work || false,
        company.provides_3d_visualization || false,
        company.professional_category,
        company.budget_range,
        company.years_in_business || 0,
        company.employees_count || null,
        company.languages || [], // pg converts JS array to postgres array

        company.services_offered || [],
        company.specialties || [],
        company.service_areas || null, // String "City (Zip)"
        company.service_cities || [],
        company.service_zip_codes || [],
        company.certifications || [],
        company.awards || [],
        images,

        company.featured_reviewer_name || null,
        company.featured_review_text || null,
        company.featured_review_rating || null
      ];

      try {
        await client.query(insertCompanyQuery, values);
        successCount++;
        if (successCount % 100 === 0) {
            console.log(`Inserted ${successCount} companies...`);
        }
      } catch (err) {
        errorCount++;
        console.error(`Error inserting company ${company.company_name}:`, err.message);
      }
    }

    console.log(`Finished importing companies. Success: ${successCount}, Errors: ${errorCount}`);
    await client.end();

  } catch (err) {
    console.error('Error during import:', err);
    if (client) await client.end();
    process.exit(1);
  }
};

importCompanies();
