-- ========================================================
-- Max Global Private Bank — Core Enterprise Banking Schema
-- Regulated Scheduled Commercial Bank (RBI Standard)
-- ========================================================

CREATE DATABASE IF NOT EXISTS max_global_bank
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE max_global_bank;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(25) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL UNIQUE,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_credential_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','teller') NOT NULL DEFAULT 'teller',
  branch VARCHAR(100) NOT NULL DEFAULT 'Max Global Headquarters - Nariman Point, Mumbai',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_number CHAR(12) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  account_type ENUM('savings','current','wealth') NOT NULL DEFAULT 'savings',
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status ENUM('active','frozen','closed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_account_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT chk_account_balance CHECK (balance >= 0),
  INDEX idx_account_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference_code VARCHAR(32) NOT NULL UNIQUE,
  from_account_id BIGINT UNSIGNED NULL,
  to_account_id BIGINT UNSIGNED NULL,
  transaction_type ENUM('deposit','withdrawal','transfer','loan_disbursement','fd_booking') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('completed','rejected') NOT NULL DEFAULT 'completed',
  initiated_by_role ENUM('customer','employee','system','admin') NOT NULL,
  initiated_by_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_from FOREIGN KEY (from_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_tx_to FOREIGN KEY (to_account_id) REFERENCES accounts(id),
  INDEX idx_tx_created (created_at),
  INDEX idx_tx_from (from_account_id),
  INDEX idx_tx_to (to_account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  card_number CHAR(19) NOT NULL UNIQUE,
  card_type ENUM('debit','credit') NOT NULL DEFAULT 'debit',
  card_tier VARCHAR(50) NOT NULL DEFAULT 'Visa Platinum Privileges',
  expiry_month INT NOT NULL DEFAULT 12,
  expiry_year INT NOT NULL DEFAULT 2031,
  daily_limit DECIMAL(14,2) NOT NULL DEFAULT 200000.00,
  is_frozen TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','frozen','cancelled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_card_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_card_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  loan_type ENUM('personal','home','auto','business') NOT NULL,
  principal_amount DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  tenure_months INT NOT NULL,
  monthly_emi DECIMAL(14,2) NOT NULL,
  outstanding_balance DECIMAL(14,2) NOT NULL,
  status ENUM('approved','active','closed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_loan_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fixed_deposits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  deposit_amount DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  tenure_months INT NOT NULL,
  maturity_amount DECIMAL(14,2) NOT NULL,
  maturity_date DATE NOT NULL,
  certificate_number VARCHAR(40) NOT NULL UNIQUE,
  status ENUM('active','matured','liquidated') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fd_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_fd_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  description VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  offer_code VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  category ENUM('loans','deposits','cards','wealth','general') NOT NULL,
  badge VARCHAR(60) NOT NULL DEFAULT 'EXCLUSIVE',
  rate_headline VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  cta_text VARCHAR(60) NOT NULL DEFAULT 'Apply Now',
  cta_target VARCHAR(60) NOT NULL DEFAULT 'register',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_role ENUM('customer','employee','system','admin') NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(80) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_role, actor_id)
) ENGINE=InnoDB;
