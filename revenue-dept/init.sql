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
