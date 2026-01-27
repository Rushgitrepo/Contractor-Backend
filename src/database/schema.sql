-- CLEANUP: Drop all existing tables to ensure no duplicates or schema collisions
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS register CASCADE; -- Remove the temporary table we made
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS general_contractors CASCADE;
DROP TABLE IF EXISTS sub_contractors CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS client_profiles CASCADE;
DROP TABLE IF EXISTS contractor_profiles CASCADE;
DROP TABLE IF EXISTS general_contractor_profiles CASCADE;
DROP TABLE IF EXISTS sub_contractor_profiles CASCADE;
DROP TABLE IF EXISTS supplier_profiles CASCADE;
DROP TABLE IF EXISTS client_profiles_legacy CASCADE;
DROP TABLE IF EXISTS contractor_profiles_legacy CASCADE;

-- Create users table (Conventional name for Identity)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'general-contractor', 'subcontractor', 'vendor', 'admin')),
  phone VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(500),
  reset_password_token VARCHAR(500),
  reset_password_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create refresh_tokens table
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SPECIFIC PROFILE TABLES (New Registration)
-- ============================================

-- Client Profile
CREATE TABLE client_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_type VARCHAR(100),
  budget_range VARCHAR(100),
  timeline VARCHAR(100),
  property_size VARCHAR(50),
  company_name VARCHAR(255),
  financing_status VARCHAR(100),
  property_address TEXT,
  role VARCHAR(100),
  interests TEXT[],
  goals TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- General Contractor Profile
CREATE TABLE general_contractor_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  company_size VARCHAR(50),
  years_in_business INTEGER,
  project_size_range VARCHAR(100),
  address TEXT,
  role VARCHAR(100),
  trades TEXT[],
  goals TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub Contractor Profile
CREATE TABLE sub_contractor_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  company_size VARCHAR(50),
  years_in_business INTEGER,
  service_area VARCHAR(255),
  address TEXT,
  role VARCHAR(100),
  trades TEXT[],
  goals TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Supplier Profile
CREATE TABLE supplier_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  company_size VARCHAR(50),
  business_type VARCHAR(100),
  years_in_business INTEGER,
  delivery_radius INTEGER,
  min_order_value VARCHAR(100),
  offer_credit_terms BOOLEAN DEFAULT FALSE,
  address TEXT,
  role VARCHAR(100),
  product_categories TEXT[],
  goals TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMPANIES TABLES (Directory listing)
-- ============================================

-- Drop existing companies table and potential leftovers
DROP TABLE IF EXISTS company_images CASCADE;
DROP TABLE IF EXISTS company_reviews CASCADE;
DROP TABLE IF EXISTS company_awards CASCADE;
DROP TABLE IF EXISTS company_certifications CASCADE;
DROP TABLE IF EXISTS company_specialties CASCADE;
DROP TABLE IF EXISTS service_areas CASCADE;
DROP TABLE IF EXISTS services_offered CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Create companies table with aggregated columns
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
  
  -- Aggregated arrays/fields from previous tables
  services_offered TEXT[],
  specialties TEXT[],
  service_areas TEXT, -- Keeping original string format "City (Zip)"
  service_cities TEXT[],
  service_zip_codes TEXT[],
  certifications TEXT[],
  awards TEXT[],
  
  -- Images (stored as array of URLs)
  images TEXT[], -- [image_url, image_url_2, image_url_3]
  
  -- Featured Review
  featured_reviewer_name VARCHAR(255),
  featured_review_text TEXT,
  featured_review_rating DECIMAL(3,2),

  update_token VARCHAR(500) UNIQUE,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_companies_name ON companies(company_name);
CREATE INDEX idx_companies_rating ON companies(rating DESC);
CREATE INDEX idx_companies_verified ON companies(verified_business);
CREATE INDEX idx_companies_category ON companies(professional_category);

-- Create updated_at trigger for companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
