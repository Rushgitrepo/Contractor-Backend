-- CLEANUP: Drop all existing tables to ensure no duplicates or schema collisions


-- Create users table (Conventional name for Identity)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'general-contractor', 'subcontractor', 'supplier', 'admin')),
  phone VARCHAR(50),
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

-- Create verification_codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL, -- email or phone
  type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms')),
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification_codes(identifier);

-- ============================================

-- SPECIFIC PROFILE TABLES (New Registration)
-- ============================================

-- Client Profile
CREATE TABLE IF NOT EXISTS client_profiles (
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
CREATE TABLE IF NOT EXISTS general_contractor_profiles (
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
  tagline TEXT,
  description TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  verified_hires INTEGER DEFAULT 0,
  website VARCHAR(500),
  images TEXT[],
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
  budget_range VARCHAR(50),
  employees_count VARCHAR(50),
  languages TEXT[],
  services_offered TEXT[],
  specialties TEXT[],
  service_areas TEXT,
  service_cities TEXT[],
  service_zip_codes TEXT[],
  awards TEXT[],
  certifications TEXT[],
  featured_reviewer_name VARCHAR(255),
  featured_review_text TEXT,
  featured_review_rating DECIMAL(3,2),
  profile_completed BOOLEAN DEFAULT FALSE,
  last_reminder_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub Contractor Profile
CREATE TABLE IF NOT EXISTS sub_contractor_profiles (
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
CREATE TABLE IF NOT EXISTS supplier_profiles (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

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

-- Drop only old/unused tables (not companies table to preserve data)
-- NOTE: DO NOT DROP companies table - it contains data!
-- DROP TABLE IF EXISTS companies CASCADE;

-- Create companies table with aggregated columns (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS companies (
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
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_rating ON companies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON companies(verified_business);
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(professional_category);

-- Create updated_at trigger for companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- REAL-TIME MESSAGING (v2)
-- ============================================

-- Conversations (Chat Rooms)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  type VARCHAR(20) NOT NULL CHECK (type IN ('direct','group','project')),
  related_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(related_project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Participants (Users in a conversation)
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cp_user ON conversation_participants(user_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text','image','file','system')),
  content TEXT,
  attachments JSONB DEFAULT '[]',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- ============================================
-- GC DASHBOARD TABLES
-- ============================================


-- Projects Table
CREATE TABLE IF NOT EXISTS gc_projects (
  id SERIAL PRIMARY KEY,
  gc_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  client VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'In Progress', 'Bidding', 'On Hold', 'Completed', 'Cancelled')),
  budget DECIMAL(15, 2),
  duration INTEGER, -- in months
  description TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- Team Members Table
CREATE TABLE IF NOT EXISTS gc_team_members (
  id SERIAL PRIMARY KEY,
  gc_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(100), -- Project Manager, Site Supervisor, etc.
  employee_id VARCHAR(100),
  type VARCHAR(50) NOT NULL CHECK (type IN ('Direct Employee', 'Contractor')),
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Terminated')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Project Team Assignments (Many-to-Many)
CREATE TABLE IF NOT EXISTS gc_project_team_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES gc_projects(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES gc_team_members(id) ON DELETE CASCADE,
  role VARCHAR(100), -- Role in this specific project
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, team_member_id) -- Same person can't be assigned twice to same project
);

-- Documents Table
CREATE TABLE IF NOT EXISTS gc_documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES gc_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- pdf, jpg, png, etc.
  file_size BIGINT NOT NULL, -- in bytes
  category VARCHAR(50) NOT NULL CHECK (category IN ('Plans', 'Drawings', 'Photos', 'Contracts', 'Invoices', 'Other')),
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  starred BOOLEAN DEFAULT FALSE,
  shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for GC Dashboard tables
CREATE INDEX IF NOT EXISTS idx_gc_projects_gc_id ON gc_projects(gc_id);
CREATE INDEX IF NOT EXISTS idx_gc_projects_status ON gc_projects(status);
CREATE INDEX IF NOT EXISTS idx_gc_projects_deleted_at ON gc_projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gc_team_members_gc_id ON gc_team_members(gc_id);
CREATE INDEX IF NOT EXISTS idx_gc_project_team_project_id ON gc_project_team_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_gc_project_team_member_id ON gc_project_team_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_gc_documents_project_id ON gc_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_gc_documents_category ON gc_documents(category);
CREATE INDEX IF NOT EXISTS idx_gc_documents_uploaded_by ON gc_documents(uploaded_by);

-- Project Invitations Table
CREATE TABLE IF NOT EXISTS gc_project_invitations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES gc_projects(id) ON DELETE CASCADE,
  gc_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(100),
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for invitations
CREATE INDEX IF NOT EXISTS idx_invitations_project_id ON gc_project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON gc_project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON gc_project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON gc_project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_phone ON gc_project_invitations(phone);

-- Create updated_at triggers for GC Dashboard tables
DROP TRIGGER IF EXISTS update_gc_projects_updated_at ON gc_projects;
CREATE TRIGGER update_gc_projects_updated_at BEFORE UPDATE ON gc_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gc_team_members_updated_at ON gc_team_members;
CREATE TRIGGER update_gc_team_members_updated_at BEFORE UPDATE ON gc_team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gc_documents_updated_at ON gc_documents;
CREATE TRIGGER update_gc_documents_updated_at BEFORE UPDATE ON gc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gc_invitations_updated_at ON gc_project_invitations;
CREATE TRIGGER update_gc_invitations_updated_at BEFORE UPDATE ON gc_project_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
