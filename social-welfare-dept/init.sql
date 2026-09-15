-- GovConnect — Social Welfare Department (Issuer #2)
-- Database Schema and Seed Data for 'govconnect_social_welfare'

CREATE TABLE IF NOT EXISTS citizens (
  id SERIAL PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  caste_category TEXT NOT NULL,
  caste_name TEXT NOT NULL,
  certificate_number TEXT NOT NULL,
  address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issued_credentials (
  id SERIAL PRIMARY KEY,
  citizen_id INTEGER REFERENCES citizens(id),
  credential_json JSONB NOT NULL,
  signature TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now()
);

-- Seed exactly 20 fictional demonstration citizens
-- Safe against accidental duplicate initialization if already seeded
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM citizens) THEN
    INSERT INTO citizens (applicant_name, date_of_birth, caste_category, caste_name, certificate_number, address) VALUES
      ('Ramesh Kumar Patil', '1988-04-12', 'OBC', 'Kunbi', 'MS-CC-2023-001089', '12, Shivaji Nagar, Pune, Maharashtra'),
      ('Sunita Devi Sharma', '1979-11-03', 'OBC', 'Teli', 'MS-CC-2022-003421', '45, Gandhi Road, Nagpur, Maharashtra'),
      ('Ramesh K. Patil', '1988-04-12', 'OBC', 'Kunbi', 'MS-CC-2023-001090', '12, Shivaji Nagar, Pune, Maharashtra'),
      ('Rajesh Vitthal Shinde', '1985-07-22', 'SC', 'Mahar', 'MS-CC-2021-005112', 'Flat 402, Sai Shraddha Apts, Hadapsar, Pune, Maharashtra'),
      ('Ananya Suresh Pawar', '1995-03-15', 'ST', 'Bhil', 'MS-CC-2023-008741', 'House 18, Tribal Colony, Trimbak Road, Nashik, Maharashtra'),
      ('Ganesh Bapurao Gaikwad', '1990-11-28', 'SC', 'Matang', 'MS-CC-2022-004192', '78, Ambedkar Nagar, CIDCO, Chhatrapati Sambhaji Nagar, Maharashtra'),
      ('Meena Prakash Jadhav', '1982-09-04', 'VJNT', 'Banjara', 'MS-CC-2020-002934', '14, Vasant Nagar, Nanded, Maharashtra'),
      ('Nitin Ashok Deshmukh', '1992-01-19', 'OBC', 'Mali', 'MS-CC-2024-001156', '56, Panchavati Colony, Satara, Maharashtra'),
      ('Priya Vilas Kamble', '1996-08-30', 'SC', 'Chambhar', 'MS-CC-2023-006320', 'Room 12, Chawl 4, Dharavi, Mumbai, Maharashtra'),
      ('Sandeep Devidas Rathod', '1987-05-14', 'VJNT', 'Ramoshi', 'MS-CC-2021-007845', 'Plot 22, Shahu Nagar, Solapur, Maharashtra'),
      ('Pooja Eknath Sonawane', '1994-12-08', 'SBC', 'Koli', 'MS-CC-2022-009183', '29, Versova Koliwada, Andheri West, Mumbai, Maharashtra'),
      ('Santosh Manikrao Kadam', '1983-06-25', 'OBC', 'Agri', 'MS-CC-2020-003847', '104, Shree Ganesh Complex, Dombivli East, Thane, Maharashtra'),
      ('Kavita Ramdas More', '1991-02-17', 'SC', 'Boudh', 'MS-CC-2024-002491', '83, Buddha Vihar Road, Amravati, Maharashtra'),
      ('Deepak Pandurang Chavan', '1989-10-11', 'VJNT', 'Dhangar', 'MS-CC-2022-005612', '61, Malhar Chowk, Baramati, Pune, Maharashtra'),
      ('Swati Balasaheb Koli', '1997-04-05', 'SBC', 'Machhimar Koli', 'MS-CC-2023-010478', '44, Alibag Fishermen Colony, Raigad, Maharashtra'),
      ('Vijay Mahadev Kokate', '1986-12-21', 'ST', 'Gond', 'MS-CC-2021-006734', '15, Forest Range Quarters, Chandrapur, Maharashtra'),
      ('Rekha Tukaram Lohar', '1993-07-09', 'OBC', 'Lohar', 'MS-CC-2024-003290', 'Shop 5, Vishwakarma Lane, Kolhapur, Maharashtra'),
      ('Ajay Prabhakar Waghmare', '1990-03-24', 'SC', 'Holar', 'MS-CC-2022-007321', '37, Mill Area, Sangli, Maharashtra'),
      ('Sharda Subhash Sutar', '1984-08-16', 'OBC', 'Sutar', 'MS-CC-2020-004918', '92, Tilak Chowk, Jalgaon, Maharashtra'),
      ('Manoj Narayan Koshti', '1991-05-02', 'SBC', 'Koshti', 'MS-CC-2023-008129', '51, Weaver Colony, Ichalkaranji, Kolhapur, Maharashtra');
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
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'swd_officer_01') THEN
    INSERT INTO users (username, password_hash, role, department, is_active) VALUES
      ('swd_officer_01', 'scrypt$16384$8$1$582cdfc4a9e882ad0657ce8f540fe2e6$2c6f5110e582e928cd09f256ced69248d9f4195138012102d71e990412f5b84cba7ed906625c979f910133bfaed98eb2161f502fe8bcacea08a1668c22eb653d', 'ISSUER_OFFICER', 'social_welfare', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'swd_admin_01') THEN
    INSERT INTO users (username, password_hash, role, department, is_active) VALUES
      ('swd_admin_01', 'scrypt$16384$8$1$edb7c11e76d1a61c5f20e704338fe62f$c31bbc4525a3a55c5f57075e912b08e9657d52fc094c1b42b2de22dde9ce331c5645a57db008dfdac71440b6fab70ba7f4c5579eacdb2f60b859f5546e484ef3', 'ADMIN', 'social_welfare', true);
  END IF;
END $$;

