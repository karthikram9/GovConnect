-- GovConnect — Revenue Department (Issuer #1)
-- Database Schema and Seed Data for 'govconnect_revenue'

CREATE TABLE IF NOT EXISTS citizens (
  id SERIAL PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  annual_income INTEGER NOT NULL,
  pan_number TEXT NOT NULL,
  address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issued_credentials (
  id SERIAL PRIMARY KEY,
  citizen_id INTEGER REFERENCES citizens(id),
  credential_json JSONB NOT NULL,
  signature TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now()
);

-- Seed exactly three required citizens
-- Safe against accidental duplicate initialization if already seeded
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM citizens) THEN
    INSERT INTO citizens (applicant_name, date_of_birth, annual_income, pan_number, address) VALUES
      ('Ramesh Kumar Patil', '1988-04-12', 312000, 'ABCDE1234F', '12, Shivaji Nagar, Pune, Maharashtra'),
      ('Sunita Devi Sharma', '1979-11-03', 245000, 'PQRSX5678K', '45, Gandhi Road, Nagpur, Maharashtra'),
      ('Ramesh K. Patil', '1988-04-12', 312000, 'ABCDE1234F', '12, Shivaji Nagar, Pune, Maharashtra');
  END IF;
END $$;

-- Operator Accounts Table (Phase 4A Authentication Foundation)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Initial Prototype Operator Accounts (Scrypt Hashed, Development Only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'rev_officer_01') THEN
    INSERT INTO users (username, password_hash, role, department, is_active) VALUES
      ('rev_officer_01', 'scrypt$16384$8$1$582cdfc4a9e882ad0657ce8f540fe2e6$2c6f5110e582e928cd09f256ced69248d9f4195138012102d71e990412f5b84cba7ed906625c979f910133bfaed98eb2161f502fe8bcacea08a1668c22eb653d', 'ISSUER_OFFICER', 'revenue', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'rev_admin_01') THEN
    INSERT INTO users (username, password_hash, role, department, is_active) VALUES
      ('rev_admin_01', 'scrypt$16384$8$1$edb7c11e76d1a61c5f20e704338fe62f$c31bbc4525a3a55c5f57075e912b08e9657d52fc094c1b42b2de22dde9ce331c5645a57db008dfdac71440b6fab70ba7f4c5579eacdb2f60b859f5546e484ef3', 'ADMIN', 'revenue', true);
  END IF;
END $$;

