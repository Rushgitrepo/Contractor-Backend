import { Pool } from 'pg';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

async function importComplete() {
  const client = await pool.connect();
  
  try {
    console.log('Creating complete single-table database...\n');
    
    // Drop all tables
    console.log('Dropping all tables...');
    await client.query(`
      DROP TABLE IF EXISTS company_images CASCADE;
      DROP TABLE IF EXISTS company_reviews CASCADE;
      DROP TABLE IF EXISTS company_awards CASCADE;
      DROP TABLE IF EXISTS company_certifications CASCADE;
      DROP TABLE IF EXISTS company_specialties CASCADE;
      DROP TABLE IF EXISTS service_areas CASCADE;
      DROP TABLE IF EXISTS services_offered CASCADE;
      DROP TABLE IF EXISTS companies CASCADE;
    `);
    console.log('Tables dropped\n');
    
    // Create ONE companies table with ALL data
    console.log('Creating single companies table with all data...');
    await client.query(`
      CREATE TABLE companies (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(500) NOT NULL,
        tagline TEXT,
        description TEXT,
        rating DECIMAL(3,2),
        reviews_count INTEGER DEFAULT 0,
        verified_hires INTEGER DEFAULT 0,
        
        -- Contact Info
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        website VARCHAR(500),
        
        -- Images
        image_url TEXT,
        image_url_2 TEXT,
        image_url_3 TEXT,
        
        -- Business Details
        license_number VARCHAR(100),
        verified_business BOOLEAN DEFAULT FALSE,
        responds_quickly BOOLEAN DEFAULT FALSE,
        hired_on_platform BOOLEAN DEFAULT FALSE,
        family_owned BOOLEAN DEFAULT FALSE,
        eco_friendly BOOLEAN DEFAULT FALSE,
        locally_owned BOOLEAN DEFAULT FALSE,
        offers_custom_work BOOLEAN DEFAULT FALSE,
        provides_3d_visualization BOOLEAN DEFAULT FALSE,
        professional_category VARCHAR(255),
        budget_range VARCHAR(100),
        years_in_business INTEGER,
        employees_count VARCHAR(50),
        languages TEXT[],
        
        -- Services and Specialties (as arrays)
        services_offered TEXT[],
        specialties TEXT[],
        
        -- Service Areas (as text)
        service_areas TEXT,
        service_cities TEXT[],
        service_zip_codes TEXT[],
        
        -- Awards and Certifications (as arrays)
        awards TEXT[],
        certifications TEXT[],
        
        -- Reviews
        featured_reviewer_name VARCHAR(255),
        featured_review_text TEXT,
        featured_review_rating DECIMAL(3,2),
        
        -- Update Token
        update_token VARCHAR(500) UNIQUE,
        token_expires_at TIMESTAMP,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_companies_name ON companies(company_name);
      CREATE INDEX idx_companies_rating ON companies(rating DESC);
      CREATE INDEX idx_companies_verified ON companies(verified_business);
      CREATE INDEX idx_companies_phone ON companies(phone);
      CREATE INDEX idx_companies_email ON companies(email);
      CREATE INDEX idx_companies_services ON companies USING GIN(services_offered);
      CREATE INDEX idx_companies_cities ON companies USING GIN(service_cities);
      CREATE INDEX idx_companies_zip_codes ON companies USING GIN(service_zip_codes);
    `);
    console.log('Single table created\n');
    
    // Read JSON file
    console.log('Reading companies.json...');
    const jsonPath = path.join(__dirname, '../data/companies.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    const companies = JSON.parse(jsonData);
    console.log(`Found ${companies.length} companies\n`);
    
    // Import companies
    console.log('Importing all data into single table...');
    let successCount = 0;
    
    for (let i = 0; i < companies.length; i++) {
      try {
        const rawData = companies[i];
        
        // Handle both flat and nested formats
        const isNested = rawData.company && rawData.company.name;
        const data = isNested ? {
          company_name: rawData.company.name,
          tagline: rawData.tagline || rawData.company.tagline,
          description: rawData.company.details?.description,
          rating: rawData.company.rating,
          reviews_count: rawData.reviews_count || rawData.company.reviews_count,
          verified_hires: rawData.verified_hires || rawData.company.verified_hires,
          phone: rawData.company.details?.phone,
          email: rawData.company.details?.email,
          address: rawData.company.details?.address,
          website: rawData.company.details?.website,
          image_url: rawData.company.details?.images?.[0],
          image_url_2: rawData.company.details?.images?.[1],
          image_url_3: rawData.company.details?.images?.[2],
          license_number: rawData.company.details?.license_number,
          verified_business: rawData.company.details?.verified_business,
          responds_quickly: rawData.company.details?.responds_quickly,
          hired_on_platform: rawData.company.details?.hired_on_platform,
          family_owned: rawData.company.details?.family_owned,
          eco_friendly: rawData.company.details?.eco_friendly,
          locally_owned: rawData.company.details?.locally_owned,
          offers_custom_work: rawData.company.details?.offers_custom_work,
          provides_3d_visualization: rawData.company.details?.provides_3d_visualization,
          professional_category: rawData.company.details?.professional_category,
          budget_range: rawData.company.details?.budget_range,
          years_in_business: rawData.company.details?.years_in_business,
          employees_count: rawData.company.details?.employees_count,
          languages: rawData.company.details?.languages,
          services_offered: rawData.company.details?.services_offered,
          specialties: rawData.company.details?.specialties,
          service_areas: rawData.company.details?.service_areas,
          service_cities: rawData.company.details?.service_areas?.map((a: any) => a.city),
          service_zip_codes: rawData.company.details?.service_areas?.map((a: any) => a.zip_code || a.zip),
          awards: rawData.company.details?.awards,
          certifications: rawData.company.details?.certifications,
          featured_reviewer_name: rawData.featured_review?.reviewer || rawData.company.featured_review?.reviewer,
          featured_review_text: rawData.featured_review?.review_text || rawData.company.featured_review?.review_text,
          featured_review_rating: rawData.featured_review?.rating || rawData.company.featured_review?.rating
        } : rawData;
        
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
        
        // Get images (flat structure)
        const image1 = cleanString(data.image_url);
        const image2 = cleanString(data.image_url_2);
        const image3 = cleanString(data.image_url_3);
        
        // Get services (flat structure)
        const services = data.services_offered && Array.isArray(data.services_offered) 
          ? data.services_offered 
          : [];
        
        // Get specialties (flat structure)
        const specialties = data.specialties && Array.isArray(data.specialties)
          ? data.specialties
          : [];
        
        // Get service areas (handle both string and array formats)
        let serviceAreasText = null;
        let serviceCities: string[] = [];
        let serviceZipCodes: string[] = [];
        
        if (typeof data.service_areas === 'string') {
          // Flat format - already a string
          serviceAreasText = cleanString(data.service_areas);
          serviceCities = data.service_cities && Array.isArray(data.service_cities) ? data.service_cities : [];
          serviceZipCodes = data.service_zip_codes && Array.isArray(data.service_zip_codes) ? data.service_zip_codes : [];
        } else if (Array.isArray(data.service_areas)) {
          // Nested format - array of objects
          const areas = data.service_areas.map((area: any) => {
            const city = area.city || '';
            const zip = area.zip_code || area.zip || '';
            if (city) serviceCities.push(city);
            if (zip) serviceZipCodes.push(zip);
            return `${city} (${zip})`;
          }).filter((a: string) => a !== ' ()');
          serviceAreasText = areas.length > 0 ? areas.join(', ') : null;
        }
        
        // Get awards (flat structure)
        const awards = data.awards && Array.isArray(data.awards)
          ? data.awards
          : [];
        
        // Get certifications (flat structure)
        const certifications = data.certifications && Array.isArray(data.certifications)
          ? data.certifications
          : [];
        
        // Get featured review (flat structure)
        const reviewerName = cleanString(data.featured_reviewer_name);
        const reviewText = cleanString(data.featured_review_text);
        const reviewRating = cleanRating(data.featured_review_rating);
        
        // Insert everything into ONE row (flat structure)
        await client.query(`
          INSERT INTO companies (
            company_name, tagline, description, rating, reviews_count, verified_hires,
            phone, email, address, website,
            image_url, image_url_2, image_url_3,
            license_number, verified_business, responds_quickly, hired_on_platform,
            family_owned, eco_friendly, locally_owned, offers_custom_work,
            provides_3d_visualization, professional_category, budget_range,
            years_in_business, employees_count, languages,
            services_offered, specialties,
            service_areas, service_cities, service_zip_codes,
            awards, certifications,
            featured_reviewer_name, featured_review_text, featured_review_rating
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
          image1,
          image2,
          image3,
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
          services.length > 0 ? services : null,
          specialties.length > 0 ? specialties : null,
          serviceAreasText,
          serviceCities.length > 0 ? serviceCities : null,
          serviceZipCodes.length > 0 ? serviceZipCodes : null,
          awards.length > 0 ? awards : null,
          certifications.length > 0 ? certifications : null,
          reviewerName,
          reviewText,
          reviewRating
        ]);
        
        successCount++;
        if (successCount % 50 === 0) {
          console.log(`  ✓ Imported ${successCount} companies...`);
        }
      } catch (error) {
        console.error(`  ✗ Error importing company ${i + 1} (${companies[i].company_name}):`, error);
      }
    }
    
    console.log(`\nSuccessfully imported ${successCount} out of ${companies.length} companies!\n`);
    
    // Verify
    const result = await client.query('SELECT COUNT(*) FROM companies');
    console.log(`Total companies in database: ${result.rows[0].count}\n`);
    
    console.log('ALL DATA IN ONE TABLE!');
    console.log('   Run: SELECT * FROM companies;');
    console.log('   Everything (phone, email, images, services, awards, etc.) is in one row!\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importComplete()
  .then(() => {
    console.log('Complete import finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
