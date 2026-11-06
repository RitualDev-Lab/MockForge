-- MockForge AI: Sample Enterprise Fintech & Payments Schema

CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  org_nm VARCHAR(150) NOT NULL,
  acct_tier VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE account_users (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  c_fname VARCHAR(100) NOT NULL,
  c_lname VARCHAR(100) NOT NULL,
  c_eml VARCHAR(150) NOT NULL,
  c_tel VARCHAR(50) NOT NULL,
  kyc_st VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES account_users(id),
  tx_st_cd VARCHAR(25) NOT NULL,
  pay_mthd VARCHAR(30) NOT NULL,
  mrr_cents INT NOT NULL,
  ip_orig VARCHAR(45) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
