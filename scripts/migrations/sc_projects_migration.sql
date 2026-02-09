-- ============================================
-- SC (SUBCONTRACTOR) PROJECTS TABLE
-- ============================================
-- This table stores projects that subcontractors are working on
-- These are different from GC projects - they represent SC's own project tracking

CREATE TABLE IF NOT EXISTS sc_projects (
  id SERIAL PRIMARY KEY,
  sc_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Project Basic Info
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255),                    -- The GC or client they're working for
  project_type VARCHAR(100),              -- Type of work (matches SC's trades)
  trade VARCHAR(100),                     -- Primary trade for this project
  
  -- Location
  city VARCHAR(100),
  state VARCHAR(50),
  address TEXT,
  
  -- Financials
  contract_value DECIMAL(15, 2),
  
  -- Status & Progress
  status VARCHAR(50) NOT NULL DEFAULT 'Planning' 
    CHECK (status IN ('Planning', 'Bidding', 'Active', 'Completed', 'On Hold')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  phase VARCHAR(100),                     -- Current project phase
  
  -- Dates
  start_date DATE,
  expected_completion_date DATE,
  actual_completion_date DATE,
  
  -- Team
  team_size INTEGER DEFAULT 0,
  
  -- Reference to original GC project (if applicable)
  gc_project_id INTEGER REFERENCES gc_projects(id) ON DELETE SET NULL,
  
  -- Metadata
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- SC Project Team Assignments (field workers assigned to SC projects)
CREATE TABLE IF NOT EXISTS sc_project_team (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES sc_projects(id) ON DELETE CASCADE,
  member_name VARCHAR(255) NOT NULL,
  role VARCHAR(100),                      -- Foreman, Technician, Laborer, etc.
  phone VARCHAR(50),
  email VARCHAR(255),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'))
);

-- SC Documents Table
CREATE TABLE IF NOT EXISTS sc_documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES sc_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,         -- pdf, jpg, png, etc.
  file_size BIGINT NOT NULL,              -- in bytes
  category VARCHAR(50) NOT NULL 
    CHECK (category IN ('Plans', 'Drawings', 'Photos', 'Contracts', 'Invoices', 'Safety', 'Permits', 'Other')),
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  starred BOOLEAN DEFAULT FALSE,
  shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for SC Projects tables
CREATE INDEX IF NOT EXISTS idx_sc_projects_sc_id ON sc_projects(sc_id);
CREATE INDEX IF NOT EXISTS idx_sc_projects_status ON sc_projects(status);
CREATE INDEX IF NOT EXISTS idx_sc_projects_trade ON sc_projects(trade);
CREATE INDEX IF NOT EXISTS idx_sc_projects_deleted_at ON sc_projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sc_project_team_project_id ON sc_project_team(project_id);
CREATE INDEX IF NOT EXISTS idx_sc_documents_project_id ON sc_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_sc_documents_category ON sc_documents(category);

-- Create updated_at triggers for SC tables
DROP TRIGGER IF EXISTS update_sc_projects_updated_at ON sc_projects;
CREATE TRIGGER update_sc_projects_updated_at BEFORE UPDATE ON sc_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sc_documents_updated_at ON sc_documents;
CREATE TRIGGER update_sc_documents_updated_at BEFORE UPDATE ON sc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
