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
