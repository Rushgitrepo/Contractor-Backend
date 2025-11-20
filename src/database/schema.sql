-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'contractor')),
  phone VARCHAR(50),
  company VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(500),
  reset_password_token VARCHAR(500),
  reset_password_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create contractor_profiles table
CREATE TABLE IF NOT EXISTS contractor_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(100),
  business_address TEXT,
  years_experience VARCHAR(50),
  specialties TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create client_profiles table
CREATE TABLE IF NOT EXISTS client_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_type VARCHAR(100),
  budget VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_user_id ON contractor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers (drop if exists first)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contractor_profiles_updated_at ON contractor_profiles;
CREATE TRIGGER update_contractor_profiles_updated_at BEFORE UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_profiles_updated_at ON client_profiles;
CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired refresh tokens periodically (optional, can be run as a cron job)
CREATE OR REPLACE FUNCTION delete_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- COMPANIES TABLES
-- ============================================

-- Drop existing companies table
DROP TABLE IF EXISTS company_images CASCADE;
DROP TABLE IF EXISTS company_reviews CASCADE;
DROP TABLE IF EXISTS company_awards CASCADE;
DROP TABLE IF EXISTS company_certifications CASCADE;
DROP TABLE IF EXISTS company_specialties CASCADE;
DROP TABLE IF EXISTS service_areas CASCADE;
DROP TABLE IF EXISTS services_offered CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Create companies table with proper columns
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(500) NOT NULL,
  tagline TEXT,
  description TEXT,
  rating DECIMAL(3,2),
  reviews_count INTEGER DEFAULT 0,
  verified_hires INTEGER DEFAULT 0,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  website VARCHAR(500),
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
  update_token VARCHAR(500) UNIQUE,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create services_offered table
CREATE TABLE services_offered (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL
);

-- Create service_areas table
CREATE TABLE service_areas (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  city VARCHAR(255),
  state VARCHAR(100),
  zip_code VARCHAR(20)
);

-- Create company_specialties table
CREATE TABLE company_specialties (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  specialty VARCHAR(255) NOT NULL
);

-- Create company_certifications table
CREATE TABLE company_certifications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  certification VARCHAR(500) NOT NULL
);

-- Create company_awards table
CREATE TABLE company_awards (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  award VARCHAR(500) NOT NULL
);

-- Create company_images table
CREATE TABLE company_images (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create company_reviews table
CREATE TABLE company_reviews (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reviewer_name VARCHAR(255),
  review_text TEXT,
  rating DECIMAL(3,2),
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_companies_name ON companies(company_name);
CREATE INDEX idx_companies_rating ON companies(rating DESC);
CREATE INDEX idx_companies_verified ON companies(verified_business);
CREATE INDEX idx_services_company_id ON services_offered(company_id);
CREATE INDEX idx_services_name ON services_offered(service_name);
CREATE INDEX idx_service_areas_company_id ON service_areas(company_id);
CREATE INDEX idx_service_areas_zip ON service_areas(zip_code);
CREATE INDEX idx_service_areas_city ON service_areas(city);
CREATE INDEX idx_specialties_company_id ON company_specialties(company_id);
CREATE INDEX idx_certifications_company_id ON company_certifications(company_id);
CREATE INDEX idx_awards_company_id ON company_awards(company_id);
CREATE INDEX idx_images_company_id ON company_images(company_id);
CREATE INDEX idx_reviews_company_id ON company_reviews(company_id);

-- Create updated_at trigger for companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
