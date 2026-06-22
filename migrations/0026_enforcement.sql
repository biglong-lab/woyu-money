-- 2026-06-22：強制執行管理（公文/圈存/分期）— 只加不刪
CREATE TABLE IF NOT EXISTS enforcement_cases (
  id SERIAL PRIMARY KEY,
  case_number VARCHAR(100),
  agency VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_info TEXT,
  subject TEXT,
  total_amount DECIMAL(14,2) NOT NULL,
  issued_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  attachment_url VARCHAR(500),
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enforcement_cases_status_idx ON enforcement_cases(status);
CREATE INDEX IF NOT EXISTS enforcement_cases_issued_idx ON enforcement_cases(issued_date);

CREATE TABLE IF NOT EXISTS enforcement_seizures (
  id SERIAL PRIMARY KEY,
  case_id INTEGER,
  bank_name VARCHAR(100),
  amount DECIMAL(14,2) NOT NULL,
  seizure_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'frozen',
  receipt_image_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enforcement_seizures_case_idx ON enforcement_seizures(case_id);

CREATE TABLE IF NOT EXISTS enforcement_installments (
  id SERIAL PRIMARY KEY,
  case_id INTEGER,
  plan_name VARCHAR(255),
  start_date DATE,
  monthly_amount DECIMAL(14,2) NOT NULL,
  periods INTEGER,
  day_of_month INTEGER NOT NULL DEFAULT 10,
  total_amount DECIMAL(14,2),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enforcement_installments_case_idx ON enforcement_installments(case_id);

CREATE TABLE IF NOT EXISTS enforcement_installment_payments (
  id SERIAL PRIMARY KEY,
  installment_id INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  receipt_image_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enforcement_inst_pay_installment_idx ON enforcement_installment_payments(installment_id);
