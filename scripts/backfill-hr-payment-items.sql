-- HR 月成本對應的 payment_item 補建
--
-- 邏輯：
--  1. 確保「人力成本」payment_project 存在
--  2. 對每筆 monthly_hr_costs 建一筆 payment_item：
--     - source = 'hr'（與 manual/ai_scan/webhook/pm 並列）
--     - tags = 'HR成本,薪資,勞健保'
--     - itemName = '{員工名} {年}-{月} 薪資+勞健保'
--     - totalAmount = total_cost
--     - status = is_paid ? 'paid' : 'unpaid'
--     - startDate = 該月 10 號（薪資發放日）
--     - notes = HR cost id 反查連結
--  3. 跳過已有對應 payment_item 的（用 notes LIKE '%HR-Cost #{id}%' 判斷）
--
-- 未來：cron 每月自動跑（或 UI 觸發）

BEGIN;

-- 1. 建「人力成本」project
INSERT INTO payment_projects (project_name, project_type, is_active, created_at, updated_at)
SELECT '人力成本', 'hr', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM payment_projects WHERE project_name = '人力成本' AND is_active = true
);

-- 2. 為每筆 monthly_hr_costs 建對應 payment_item
DO $$
DECLARE
  hr RECORD;
  hr_project_id INT;
  new_item_id INT;
  pay_date DATE;
  item_name_val TEXT;
  inserted_count INT := 0;
  skipped_count INT := 0;
BEGIN
  SELECT id INTO hr_project_id FROM payment_projects WHERE project_name = '人力成本' AND is_active = true LIMIT 1;

  FOR hr IN
    SELECT m.id, m.year, m.month, m.base_salary, m.total_cost, m.is_paid,
           m.employer_total, m.employee_total, m.net_salary,
           e.employee_name, e.position
    FROM monthly_hr_costs m
    JOIN employees e ON e.id = m.employee_id
    ORDER BY m.year, m.month, m.employee_id
  LOOP
    -- 跳過已建過的
    IF EXISTS (SELECT 1 FROM payment_items WHERE source = 'hr' AND notes LIKE '%HR-Cost #' || hr.id || '%' AND NOT is_deleted) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- 薪資發放日：當月 10 號
    pay_date := MAKE_DATE(hr.year, hr.month, 10);
    item_name_val := hr.employee_name || ' ' || hr.year || '-' || LPAD(hr.month::text, 2, '0') || ' 薪資+勞健保';

    INSERT INTO payment_items (
      item_name, total_amount, item_type, payment_type,
      project_id, start_date, status, paid_amount, source,
      tags, notes, priority, created_at, updated_at
    ) VALUES (
      item_name_val,
      hr.total_cost,
      'project',
      'single',
      hr_project_id,
      pay_date,
      CASE WHEN hr.is_paid THEN 'paid' ELSE 'unpaid' END,
      CASE WHEN hr.is_paid THEN hr.total_cost ELSE 0 END,
      'hr',
      'HR成本,薪資,勞健保',
      CONCAT_WS(E'\n',
        'HR-Cost #' || hr.id,
        '員工：' || hr.employee_name || '（' || hr.position || '）',
        '基本薪資：$' || hr.base_salary::int,
        '雇主負擔（勞健保+勞退）：$' || hr.employer_total::int,
        '員工自付（從薪資扣除）：$' || hr.employee_total::int,
        '員工實領：$' || hr.net_salary::int,
        '合計成本：$' || hr.total_cost::int
      ),
      2,  -- 中優先級
      NOW(), NOW()
    ) RETURNING id INTO new_item_id;

    inserted_count := inserted_count + 1;
    RAISE NOTICE '✓ 建 payment_item id=% for HR-Cost #% (%s, %s-%s)',
      new_item_id, hr.id, hr.employee_name, hr.year, LPAD(hr.month::text, 2, '0');
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════';
  RAISE NOTICE '✓ 新增 % 筆 payment_item', inserted_count;
  RAISE NOTICE '✓ 跳過 % 筆（已有對應）', skipped_count;
END $$;

-- 3. 列出新建的 HR payment_items
SELECT pi.id, pi.item_name, pi.total_amount, pi.status, pi.start_date, pi.tags
FROM payment_items pi
WHERE pi.source = 'hr' AND NOT pi.is_deleted
ORDER BY pi.start_date DESC;

COMMIT;
