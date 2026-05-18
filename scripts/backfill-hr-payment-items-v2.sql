-- HR 月成本 payment_items v2：拆成 4 筆（薪資 / 勞保 / 健保 / 勞退）
--
-- 取代 v1 的「{員工} {年月} 薪資+勞健保」單一筆。
--
-- 4 筆拆法（每月每員工）：
--   1. 薪資（給員工）= base_salary − employee_total
--      到期日 = 每月 5 號（薪資發放日）
--      keywords: 薪資 → category=other（無滯納金）
--
--   2. 勞保保費（給勞保局）= 雇主勞保+就業+職災 + 員工勞保+就業保險
--      到期日 = 每月 25 號（勞保局截止）
--      keywords: 勞保 → category=labor_insurance（0.3%/天）
--
--   3. 健保保費（給健保署）= 雇主健保 + 員工健保
--      到期日 = 每月 25 號（健保署截止）
--      keywords: 健保 → category=health_insurance（0.1%/天）
--
--   4. 勞退（給勞保局個人專戶）= 雇主 6% + 員工自願提繳
--      到期日 = 每月 25 號
--      keywords: 勞退 → category=pension（0.1%/天）
--
-- 安全：
--   - 透過 notes 內的「HR-Cost #{id} v2」標記避免重複
--   - 不刪舊的 v1 筆數、保留歷史（使用者可手動刪 id 5996/5997/5998）
--   - 重複跑安全

BEGIN;

-- 確保「人力成本」project 存在
INSERT INTO payment_projects (project_name, project_type, is_active, created_at, updated_at)
SELECT '人力成本', 'hr', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM payment_projects WHERE project_name = '人力成本' AND is_active = true
);

DO $$
DECLARE
  hr RECORD;
  hr_project_id INT;
  inserted_count INT := 0;
  skipped_count INT := 0;
  pay_salary_date DATE;
  pay_gov_date DATE;
  amt_salary NUMERIC;
  amt_labor NUMERIC;
  amt_health NUMERIC;
  amt_pension NUMERIC;
BEGIN
  SELECT id INTO hr_project_id FROM payment_projects WHERE project_name = '人力成本' AND is_active = true LIMIT 1;

  FOR hr IN
    SELECT m.id, m.year, m.month, m.is_paid,
           m.base_salary,
           m.employer_labor_insurance, m.employer_employment_insurance,
           m.employer_accident_insurance, m.employer_health_insurance,
           m.employer_pension, m.employer_total,
           m.employee_labor_insurance, m.employee_health_insurance,
           m.employee_pension, m.employee_total,
           m.net_salary, m.total_cost,
           e.employee_name, e.position
    FROM monthly_hr_costs m
    JOIN employees e ON e.id = m.employee_id
    ORDER BY m.year, m.month, m.employee_id
  LOOP
    -- 跳過已建過 v2 的（依 HR-Cost id + v2 標記）
    IF EXISTS (
      SELECT 1 FROM payment_items
      WHERE source = 'hr' AND notes LIKE '%HR-Cost #' || hr.id || ' v2%' AND NOT is_deleted
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    pay_salary_date := MAKE_DATE(hr.year, hr.month, 5);
    pay_gov_date := MAKE_DATE(hr.year, hr.month, 25);

    -- 金額計算
    -- 員工就業保險 = employee_total - 已知三項（schema 沒獨立欄位，需反推）
    -- 因 calculateInsurance 的 employeeTotal = labor + employment + health + pension
    amt_salary := hr.net_salary;
    amt_labor := COALESCE(hr.employer_labor_insurance, 0)
               + COALESCE(hr.employer_employment_insurance, 0)
               + COALESCE(hr.employer_accident_insurance, 0)
               + COALESCE(hr.employee_labor_insurance, 0)
               + GREATEST(0,
                   COALESCE(hr.employee_total, 0)
                   - COALESCE(hr.employee_labor_insurance, 0)
                   - COALESCE(hr.employee_health_insurance, 0)
                   - COALESCE(hr.employee_pension, 0)
                 );  -- 員工就業保險（反推）
    amt_health := COALESCE(hr.employer_health_insurance, 0)
                + COALESCE(hr.employee_health_insurance, 0);
    amt_pension := COALESCE(hr.employer_pension, 0)
                 + COALESCE(hr.employee_pension, 0);

    -- ① 薪資（淨薪、給員工）
    INSERT INTO payment_items (
      item_name, total_amount, item_type, payment_type,
      project_id, start_date, status, paid_amount, source,
      tags, notes, priority, created_at, updated_at
    ) VALUES (
      hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 薪資',
      amt_salary,
      'project', 'single',
      hr_project_id,
      pay_salary_date,
      CASE WHEN hr.is_paid THEN 'paid' ELSE 'unpaid' END,
      CASE WHEN hr.is_paid THEN amt_salary ELSE 0 END,
      'hr',
      'HR成本,薪資',
      'HR-Cost #' || hr.id || ' v2' || E'\n員工：' || hr.employee_name ||
      E'\n基本薪資：$' || hr.base_salary::int ||
      E'\n員工自付（扣除）：-$' || hr.employee_total::int ||
      E'\n實領淨薪：$' || hr.net_salary::int,
      2,
      NOW(), NOW()
    );

    -- ② 勞保保費（給勞保局，含員工自付代扣）
    IF amt_labor > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 勞保保費',
        amt_labor,
        'project', 'single',
        hr_project_id,
        pay_gov_date,
        'unpaid', 0,
        'hr',
        'HR成本,勞保',
        'HR-Cost #' || hr.id || ' v2' ||
        E'\n勞保（雇主 + 員工代扣）' ||
        E'\n雇主勞保：$' || COALESCE(hr.employer_labor_insurance, 0)::int ||
        E'\n雇主就業保險：$' || COALESCE(hr.employer_employment_insurance, 0)::int ||
        E'\n雇主職災：$' || COALESCE(hr.employer_accident_insurance, 0)::int ||
        E'\n員工自付勞保：$' || COALESCE(hr.employee_labor_insurance, 0)::int ||
        E'\n繳給：勞保局',
        2,
        NOW(), NOW()
      );
    END IF;

    -- ③ 健保保費（給健保署，含員工自付代扣）
    IF amt_health > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 健保保費',
        amt_health,
        'project', 'single',
        hr_project_id,
        pay_gov_date,
        'unpaid', 0,
        'hr',
        'HR成本,健保',
        'HR-Cost #' || hr.id || ' v2' ||
        E'\n健保（雇主 + 員工代扣）' ||
        E'\n雇主健保：$' || COALESCE(hr.employer_health_insurance, 0)::int ||
        E'\n員工自付健保：$' || COALESCE(hr.employee_health_insurance, 0)::int ||
        E'\n繳給：健保署',
        2,
        NOW(), NOW()
      );
    END IF;

    -- ④ 勞退提繳（給勞保局個人專戶）
    IF amt_pension > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 勞退提繳',
        amt_pension,
        'project', 'single',
        hr_project_id,
        pay_gov_date,
        'unpaid', 0,
        'hr',
        'HR成本,勞退',
        'HR-Cost #' || hr.id || ' v2' ||
        E'\n勞退（雇主提繳 6% + 員工自願提繳）' ||
        E'\n雇主勞退：$' || COALESCE(hr.employer_pension, 0)::int ||
        E'\n員工自願勞退：$' || COALESCE(hr.employee_pension, 0)::int ||
        E'\n繳給：勞保局個人專戶',
        2,
        NOW(), NOW()
      );
    END IF;

    inserted_count := inserted_count + 4;
    RAISE NOTICE '✓ HR-Cost #% (%, %-%) 建 4 筆 / 合計 $% (對照 total_cost $%)',
      hr.id, hr.employee_name, hr.year, LPAD(hr.month::text, 2, '0'),
      (amt_salary + amt_labor + amt_health + amt_pension)::int,
      hr.total_cost::int;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════';
  RAISE NOTICE '✓ 共新增 % 筆 payment_item', inserted_count;
  RAISE NOTICE '✓ 跳過 % 筆（已有 v2）', skipped_count;
END $$;

-- 列出新建的
SELECT
  id, item_name, total_amount::int AS amount, start_date, status
FROM payment_items
WHERE source = 'hr' AND notes LIKE '%v2%' AND NOT is_deleted
ORDER BY start_date, item_name
LIMIT 30;

COMMIT;
