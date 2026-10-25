-- Apply once to the Cloudflare D1 database wormstar_ai_memory.
-- Access this table only through the owner-protected Worker API.
CREATE TABLE IF NOT EXISTS ai_policy (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  policy_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO ai_policy(id,policy_json)
VALUES(1,'{"version":1,"mission":"","allowed_modes":["assistant","code","logs","ioc","ctf","report"],"required_terms":[],"max_input_chars":12000,"max_output_tokens":1500,"memory_enabled":true,"allow_web_import":true,"allow_memory_delete":true,"answer_style":"واضح ودقيق","workflow_steps":["افهم المهمة","تحقق من النطاق المسموح","استرجع المعلومات المرتبطة","حلل الأدلة","قدّم الإجابة"]}');
