-- =============================================================================
-- 档案页联调种子数据（MySQL 8.0+）
-- =============================================================================
-- 用法：
--   1. 先执行 schema.sql
--   2. 把 @seed_phone 改成你前端登录用的手机号
--   3. mysql -u root -p senior_voice < docs/database/seed_archive.sql
--
-- 覆盖表：
--   users（若手机号不存在则创建演示用户）
--   health_summaries / health_summary_items
--   health_reports / health_report_findings
--   report_glossaries
--   medical_archives（可选就诊单样例）
-- =============================================================================

SET NAMES utf8mb4;

-- ★ 改成你的登录手机号
SET @seed_phone = '13800138000';

SET @user_id = (
  SELECT id FROM users
  WHERE phone = @seed_phone AND deleted_at IS NULL
  LIMIT 1
);

-- 没有该用户则创建演示账号（密码需后端自行设置；验证码登录可直接用）
SET @user_id = IFNULL(@user_id, '11111111-1111-4111-8111-111111111111');

INSERT INTO users (id, phone, password_hash, display_name, preferred_lang, status)
VALUES (@user_id, @seed_phone, NULL, '毕小雪', 'zh', 'active')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  deleted_at = NULL;

-- 以手机号为准，重新取真实 user_id（避免 phone 已存在但 id 不同）
SET @user_id = (
  SELECT id FROM users
  WHERE phone = @seed_phone AND deleted_at IS NULL
  LIMIT 1
);

-- -----------------------------------------------------------------------------
-- 全局术语（报告详情底部）
-- -----------------------------------------------------------------------------
INSERT INTO report_glossaries (id, term, definition, sort_order, enabled) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '随诊', '如有不适，及时就诊。', 0, 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '诊治', '需要到医院专科明确诊断和（或）治疗。', 1, 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '复查', '需短期内复诊，对结果确认和动态观察。', 2, 1)
ON DUPLICATE KEY UPDATE
  definition = VALUES(definition),
  sort_order = VALUES(sort_order),
  enabled = 1;

-- -----------------------------------------------------------------------------
-- 健康问题总结（档案首页）
-- -----------------------------------------------------------------------------
DELETE FROM health_summary_items
WHERE summary_id IN (
  SELECT id FROM (
    SELECT id FROM health_summaries WHERE user_id = @user_id
  ) t
);
DELETE FROM health_summaries WHERE user_id = @user_id;

INSERT INTO health_summaries (id, user_id, title, exam_date, exam_no, summary_text) VALUES
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  @user_id,
  '健康问题总结',
  '2025-11-03',
  '312101033225',
  '综合近期体检与就诊记录，当前需重点关注以下问题：'
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  @user_id,
  '近期体检结果总结',
  '2025-11-03',
  '312101033225',
  '体重指数偏低，血脂轻度异常。建议平衡膳食、适量运动，并按医嘱复查。'
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  @user_id,
  '上次随访结果总结',
  '2024-10-24',
  '312010241108',
  '血压总体平稳，空腹血糖接近临界。建议继续监测早晚血压，控制饮食。'
);

INSERT INTO health_summary_items (id, summary_id, sort_order, content, severity) VALUES
(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  0,
  '体重指数偏低（BMI 18.2），需加强营养与适量运动',
  'medium'
),
(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  1,
  '血脂轻度异常，建议低脂饮食并定期复查',
  'medium'
),
(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  2,
  '空腹血糖接近临界，注意控制精制碳水',
  'low'
),
(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  3,
  '近期有胸闷咳嗽复诊记录，需持续观察呼吸道症状',
  'medium'
);

-- -----------------------------------------------------------------------------
-- 健康档案报告 + 异常项
-- -----------------------------------------------------------------------------
DELETE FROM health_report_findings
WHERE report_id IN (
  SELECT id FROM (
    SELECT id FROM health_reports WHERE user_id = @user_id
  ) t
);
DELETE FROM health_reports WHERE user_id = @user_id;

INSERT INTO health_reports (
  id, user_id, patient_name, exam_date, org_name, voucher_no, report_type, raw_payload
) VALUES
(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  @user_id,
  '毕小雪',
  '2025-11-03',
  '瑞慈体检上海静安机构',
  '312101033225',
  '体检报告',
  JSON_OBJECT(
    'full_text',
    '一般检查：身高 160cm，体重 46.5kg，BMI 18.2。\n血脂：总胆固醇轻度升高。\n血糖：空腹血糖接近临界。\n维生素：维生素 D 偏低。\n主检建议：平衡膳食，适量运动，三个月后复查血脂与血糖。'
  )
),
(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  @user_id,
  '毕小雪',
  '2024-10-24',
  '瑞慈体检上海静安机构',
  '312010241108',
  '体检报告',
  JSON_OBJECT(
    'full_text',
    '血压总体平稳。空腹血糖接近临界。建议继续早晚血压监测，控制饮食。'
  )
),
(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  @user_id,
  '毕小雪',
  '2023-04-10',
  '瑞慈体检上海徐汇机构',
  '312304101526',
  '体检报告',
  JSON_OBJECT('full_text', '历次体检对比：体重偏低持续存在，建议加强营养。')
);

INSERT INTO health_report_findings (id, report_id, sort_order, title, suggestion, risk_level) VALUES
(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  0,
  '【1】体重过低。体重指数 BMI 值偏低（18.2）。',
  '建议平衡膳食，适量运动，定期复查体重。',
  'medium'
),
(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  1,
  '【2】总胆固醇轻度升高。',
  '建议低脂饮食，增加有氧运动，3 个月后复查血脂。',
  'medium'
),
(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  2,
  '【3】空腹血糖接近临界。',
  '建议控制精制碳水摄入，监测血糖变化。',
  'low'
),
(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  3,
  '【4】维生素 D 偏低。',
  '建议适量日照，必要时遵医嘱补充。',
  'low'
),
(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  0,
  '【1】空腹血糖接近临界。',
  '建议控制精制碳水，继续监测血压与血糖。',
  'low'
);

-- -----------------------------------------------------------------------------
-- 可选：就诊单档案样例（OCR 保存后的列表）
-- -----------------------------------------------------------------------------
DELETE FROM medical_archives WHERE user_id = @user_id AND id = 'ffffffff-ffff-4fff-8fff-fffffffffff1';

INSERT INTO medical_archives (
  id, user_id, visit_no, diagnosis, medicine, visit_date, raw_ocr_text, source
) VALUES (
  'ffffffff-ffff-4fff-8fff-fffffffffff1',
  @user_id,
  'MZ202607270018',
  '支气管炎倾向，建议复查',
  '按医嘱服用止咳药，注意饮水',
  '2026-07-27',
  '门诊病历：主诉咳嗽胸闷……就诊号 MZ202607270018。诊断：支气管炎倾向。',
  'album'
);

SELECT
  @seed_phone AS seed_phone,
  @user_id AS user_id,
  (SELECT COUNT(*) FROM health_summaries WHERE user_id = @user_id) AS summaries,
  (SELECT COUNT(*) FROM health_reports WHERE user_id = @user_id) AS reports,
  (SELECT COUNT(*) FROM report_glossaries WHERE enabled = 1) AS glossaries;
