-- HR 月成本 payment_items v3：拆成 7 筆（自付 vs 雇主分開）
--
-- 取代 v2 的「4 筆合併」（雇主+員工代扣放同一筆）。
--
-- 7 筆組成（每月每員工）：
--   ① 薪資（給員工）         = base_salary - employee_total = net_salary
--      → 公司給員工的現金，無滯納金
--
--   ② 勞保保費 - 雇主負擔   = 雇主勞保 + 雇主就業保險 + 雇主職災
--      → 公司本身應付（給勞保局）
--      tags: HR成本,勞保,雇主負擔
--
--   ③ 勞保保費 - 員工代扣   = 員工勞保 + 員工就業保險（反推）
--      → 從員工薪資扣留代繳（給勞保局）
--      tags: HR成本,勞保,員工代扣
--
--   ④ 健保保費 - 雇主負擔   = 雇主健保
--      tags: HR成本,健保,雇主負擔
--
--   ⑤ 健保保費 - 員工代扣   = 員工健保
--      tags: HR成本,健保,員工代扣
--
--   ⑥ 勞退 - 雇主提繳 6%    = 雇主勞退
--      tags: HR成本,勞退,雇主負擔
--
--   ⑦ 勞退 - 員工自願提繳   = 員工自願勞退（若 > 0）
--      tags: HR成本,勞退,員工自願
--
-- 驗證：①+②+③+④+⑤+⑥+⑦ = total_cost = base + employer_total
-- 對帳：給勞保局 = ②+③；給健保署 = ④+⑤；給勞退 = ⑥+⑦
--
-- 安全：透過 notes 內「HR-Cost #{id} v3」標記避免重複；可重複跑

BEGIN;

DO $$
DECLARE
  hr RECORD;
  hr_project_id INT;
  inserted_count INT := 0;
  skipped_count INT := 0;
  pay_salary_date DATE;
  pay_gov_date DATE;
  -- 各分項金額
  amt_salary NUMERIC;
  emp_labor_employer NUMERIC;
  emp_labor_employee NUMERIC;
  emp_health_employer NUMERIC;
  emp_health_employee NUMERIC;
  emp_pension_employer NUMERIC;
  emp_pension_employee NUMERIC;
  emp_employment_employee NUMERIC;
BEGIN
  SELECT id INTO hr_project_id FROM payment_projects WHERE project_name = '人力成本' AND is_active = true LIMIT 1;
  IF hr_project_id IS NULL THEN
    RAISE EXCEPTION '人力成本 project 不存在';
  END IF;

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
    IF EXISTS (
      SELECT 1 FROM payment_items
      WHERE source = 'hr' AND notes LIKE '%HR-Cost #' || hr.id || ' v3%' AND NOT is_deleted
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    pay_salary_date := MAKE_DATE(hr.year, hr.month, 5);
    pay_gov_date := MAKE_DATE(hr.year, hr.month, 25);

    -- 金額拆解
    amt_salary := hr.net_salary;
    -- 員工就業保險 = employee_total - (員工勞保 + 員工健保 + 員工勞退)
    emp_employment_employee := GREATEST(0,
        COALESCE(hr.employee_total, 0)
      - COALESCE(hr.employee_labor_insurance, 0)
      - COALESCE(hr.employee_health_insurance, 0)
      - COALESCE(hr.employee_pension, 0)
    );

    emp_labor_employer := COALESCE(hr.employer_labor_insurance, 0)
                        + COALESCE(hr.employer_employment_insurance, 0)
                        + COALESCE(hr.employer_accident_insurance, 0);
    emp_labor_employee := COALESCE(hr.employee_labor_insurance, 0)
                        + emp_employment_employee;
    emp_health_employer := COALESCE(hr.employer_health_insurance, 0);
    emp_health_employee := COALESCE(hr.employee_health_insurance, 0);
    emp_pension_employer := COALESCE(hr.employer_pension, 0);
    emp_pension_employee := COALESCE(hr.employee_pension, 0);

    -- ① 薪資（淨薪）
    INSERT INTO payment_items (
      item_name, total_amount, item_type, payment_type,
      project_id, start_date, status, paid_amount, source,
      tags, notes, priority, created_at, updated_at
    ) VALUES (
      hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 薪資（淨薪）',
      amt_salary,
      'project', 'single', hr_project_id, pay_salary_date,
      CASE WHEN hr.is_paid THEN 'paid' ELSE 'unpaid' END,
      CASE WHEN hr.is_paid THEN amt_salary ELSE 0 END,
      'hr',
      'HR成本,薪資',
      'HR-Cost #' || hr.id || ' v3' ||
      E'\n員工：' || hr.employee_name || '（' || hr.position || '）' ||
      E'\n基本薪資：$' || hr.base_salary::int ||
      E'\n員工自付總計：-$' || hr.employee_total::int || '（已扣）' ||
      E'\n  ↳ 員工勞保自付：$' || COALESCE(hr.employee_labor_insurance, 0)::int ||
      E'\n  ↳ 員工就業保險自付：$' || emp_employment_employee::int ||
      E'\n  ↳ 員工健保自付：$' || COALESCE(hr.employee_health_insurance, 0)::int ||
      E'\n  ↳ 員工自願勞退：$' || COALESCE(hr.employee_pension, 0)::int ||
      E'\n實領淨薪：$' || hr.net_salary::int,
      2, NOW(), NOW()
    );

    -- ② 勞保保費 - 雇主負擔
    IF emp_labor_employer > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 勞保（雇主負擔）',
        emp_labor_employer,
        'project', 'single', hr_project_id, pay_gov_date,
        'unpaid', 0, 'hr',
        'HR成本,勞保,雇主負擔',
        'HR-Cost #' || hr.id || ' v3' ||
        E'\n勞保 - 公司本身應付（雇主負擔部分）' ||
        E'\n  ↳ 雇主勞保普通事故：$' || COALESCE(hr.employer_labor_insurance, 0)::int ||
        E'\n  ↳ 雇主就業保險：$' || COALESCE(hr.employer_employment_insurance, 0)::int ||
        E'\n  ↳ 雇主職災：$' || COALESCE(hr.employer_accident_insurance, 0)::int ||
        E'\n繳給：勞保局',
        2, NOW(), NOW()
      );
    END IF;

    -- ③ 勞保保費 - 員工代扣
    IF emp_labor_employee > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 勞保（員工代扣）',
        emp_labor_employee,
        'project', 'single', hr_project_id, pay_gov_date,
        'unpaid', 0, 'hr',
        'HR成本,勞保,員工代扣',
        'HR-Cost #' || hr.id || ' v3' ||
        E'\n勞保 - 從員工薪資扣留代繳' ||
        E'\n  ↳ 員工勞保：$' || COALESCE(hr.employee_labor_insurance, 0)::int ||
        E'\n  ↳ 員工就業保險：$' || emp_employment_employee::int ||
        E'\n繳給：勞保局（與雇主負擔合併單）',
        2, NOW(), NOW()
      );
    END IF;

    -- ④ 健保保費 - 雇主負擔
    IF emp_health_employer > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 健保（雇主負擔）',
        emp_health_employer,
        'project', 'single', hr_project_id, pay_gov_date,
        'unpaid', 0, 'hr',
        'HR成本,健保,雇主負擔',
        'HR-Cost #' || hr.id || ' v3' ||
        E'\n健保 - 公司本身應付' ||
        E'\n繳給：健保署',
        2, NOW(), NOW()
      );
    END IF;

    -- ⑤ 健保保費 - 員工代扣
    IF emp_health_employee > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 健保（員工代扣）',
        emp_health_employee,
        'project', 'single', hr_project_id, pay_gov_date,
        'unpaid', 0, 'hr',
        'HR成本,健保,員工代扣',
        'HR-Cost #' || hr.id || ' v3' ||
        E'\n健保 - 從員工薪資扣留代繳' ||
        E'\n繳給：健保署（與雇主負擔合併單）',
        2, NOW(), NOW()
      );
    END IF;

    -- ⑥ 勞退 - 雇主提繳 6%
    IF emp_pension_employer > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 勞退（雇主提繳 6%）',
        emp_pension_employer,
        'project', 'single', hr_project_id, pay_gov_date,
        'unpaid', 0, 'hr',
        'HR成本,勞退,雇主負擔',
        'HR-Cost #' || hr.id || ' v3' ||
        E'\n勞退 - 公司法定提繳 6%' ||
        E'\n繳給：勞保局個人專戶',
        2, NOW(), NOW()
      );
    END IF;

    -- ⑦ 勞退 - 員工自願提繳（若 > 0 才建）
    IF emp_pension_employee > 0 THEN
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      ) VALUES (
        hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 勞退（員工自願）',
        emp_pension_employee,
        'project', 'single', hr_project_id, pay_gov_date,
        'unpaid', 0, 'hr',
        'HR成本,勞退,員工自願',
        'HR-Cost #' || hr.id || ' v3' ||
        E'\n勞退 - 員工自願提繳（從薪資扣留）' ||
        E'\n繳給：勞保局個人專戶',
        2, NOW(), NOW()
      );
    END IF;

    inserted_count := inserted_count
      + 1
      + CASE WHEN emp_labor_employer > 0 THEN 1 ELSE 0 END
      + CASE WHEN emp_labor_employee > 0 THEN 1 ELSE 0 END
      + CASE WHEN emp_health_employer > 0 THEN 1 ELSE 0 END
      + CASE WHEN emp_health_employee > 0 THEN 1 ELSE 0 END
      + CASE WHEN emp_pension_employer > 0 THEN 1 ELSE 0 END
      + CASE WHEN emp_pension_employee > 0 THEN 1 ELSE 0 END;

    RAISE NOTICE '✓ HR-Cost #% (%, %-%) 建 6-7 筆 / 合計 $% (對照 total_cost $%)',
      hr.id, hr.employee_name, hr.year, LPAD(hr.month::text, 2, '0'),
      (amt_salary + emp_labor_employer + emp_labor_employee
       + emp_health_employer + emp_health_employee
       + emp_pension_employer + emp_pension_employee)::int,
      hr.total_cost::int;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════';
  RAISE NOTICE '✓ 共新增 % 筆 payment_item', inserted_count;
  RAISE NOTICE '✓ 跳過 % 筆（已有 v3）', skipped_count;
END $$;

-- 列出新建
SELECT id, item_name, total_amount::int AS amount, tags, start_date
FROM payment_items
WHERE source = 'hr' AND notes LIKE '%v3%' AND NOT is_deleted
ORDER BY start_date, item_name
LIMIT 30;

COMMIT;
