-- Employee directory table, mirrors the `Employee` type in src/types.ts.
-- Kept separate from `login` (auth credentials) so login rows can reference
-- an employee without the two concerns being merged into one table.
CREATE TABLE IF NOT EXISTS employee (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  department ENUM('IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance') NOT NULL,
  avatar VARCHAR(1024) NULL,
  max_workload INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Now that `employee` exists, tie login.employee_id to it. ON DELETE SET NULL
-- so removing an employee doesn't cascade into deleting their login history.
ALTER TABLE login
  ADD CONSTRAINT fk_login_employee
  FOREIGN KEY (employee_id) REFERENCES employee(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
