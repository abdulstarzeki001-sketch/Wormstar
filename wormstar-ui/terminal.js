/* The terminal uses a separate, private host and a separate in-memory token. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  if (!el('wsTermConnect')) return;
  let origin = '', token = '', socket = null, pending = null, history = [], lastGoal = '', busy = false, generation = 0;
  const status = text => { el('wsTermStatus').textContent = text; };
  const connected = () => Boolean(token && socket && socket.readyState === WebSocket.OPEN);
  function controls() {
    const up = connected();
    el('wsTermInput').disabled = !up;
    el('wsTermSend').disabled = !up;
    el('wsTermGoal').disabled = busy;
    el('wsTermDisconnect').disabled = !token;
    el('wsTermPlan').disabled = !up || busy || !el('wsTermPlan').dataset.allowed;
    el('wsTermApprove').disabled = !up || busy || !pending || !el('wsTermApprove').dataset.allowed;
  }
  function append(text) {
    // Plain text prevents command output from becoming executable markup.
    const cleaned = String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
    const out = el('wsTermOutput');
    out.textContent = (out.textContent + cleaned).slice(-120000);
    out.scrollTop = out.scrollHeight;
  }
  function disconnect() {
    const previous = socket;
    socket = null; token = ''; origin = ''; pending = null; history = []; busy = false; generation++;
    delete el('wsTermPlan').dataset.allowed;
    delete el('wsTermApprove').dataset.allowed;
    if (previous) previous.close();
    controls();
  }
  function validateOrigin(value) {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw Error('استخدم HTTPS خاصًا أو localhost على نفس الجهاز.');
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('أدخل عنوان الخادم فقط دون مسار أو بيانات دخول.');
    return url.origin;
  }
  async function api(path, body) {
    if (!origin || !token) throw Error('الطرفية غير متصلة.');
    const response = await fetch(origin + path, {method:body === undefined ? 'GET' : 'POST', cache:'no-store',
      headers:{Authorization:'Bearer ' + token, ...(body === undefined ? {} : {'Content-Type':'application/json'})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(typeof result.detail === 'string' ? result.detail : 'HTTP ' + response.status);
    return result;
  }
  el('wsTermConnect').addEventListener('click', async () => {
    el('wsTermConnect').disabled = true;
    try {
      disconnect();
      origin = validateOrigin(el('wsTermEndpoint').value.trim());
      token = el('wsTermToken').value.trim();
      if (!/^[A-Za-z0-9_-]{24,256}$/.test(token)) throw Error('مفتاح الطرفية غير صالح.');
      const health = await api('/api/health');
      if (!health.container_running) throw Error('الحاوية غير متاحة أو لم تجتز التحقق الأمني.');
      if (!Array.isArray(health.capabilities) || !health.capabilities.includes('terminal')) throw Error('صلاحية الطرفية غير مفعلة.');
      el('wsTermPlan').dataset.allowed = health.capabilities.includes('plan') ? '1' : '';
      el('wsTermApprove').dataset.allowed = health.capabilities.includes('execute') ? '1' : '';
      el('wsTermToken').value = '';
      const url = new URL(origin); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = '/ws/terminal';
      const active = new WebSocket(url.toString(), ['wormstar-terminal', 'auth.' + token]);
      socket = active;
      active.onopen = () => { if (socket !== active) return; status('متصل بالحاوية الخاصة.'); controls(); el('wsTermInput').focus(); };
      active.onmessage = event => { if (socket === active) append(event.data); };
      active.onerror = () => { if (socket === active) status('تعذّر اتصال WebSocket؛ تحقق من إعداد البوابة والأصل المسموح.'); };
      active.onclose = () => { if (socket === active) { disconnect(); status('انقطع الاتصال؛ أعد إدخال مفتاح الجلسة.'); } };
      status('جارٍ الاتصال بالحاوية...');
    } catch (error) { disconnect(); status('فشل الاتصال: ' + String(error.message || error)); }
    finally { el('wsTermConnect').disabled = false; }
  });
  el('wsTermDisconnect').addEventListener('click', () => { disconnect(); status('انقطع الاتصال.'); });
  el('wsTermForm').addEventListener('submit', event => {
    event.preventDefault();
    const command = el('wsTermInput').value;
    if (!connected() || command.length > 4000) return;
    socket.send(JSON.stringify({type:'input', data:command + '\n'}));
    el('wsTermInput').value = '';
  });
  el('wsTermGoal').addEventListener('input', () => { pending = null; controls(); });
  el('wsTermPlan').addEventListener('click', async () => {
    const goal = el('wsTermGoal').value.trim();
    if (goal.length < 3) { status('اكتب المهمة أولاً.'); return; }
    if (goal !== lastGoal) { history = []; lastGoal = goal; }
    pending = null; busy = true; controls();
    const current = generation;
    try {
      const result = await api('/api/agent/plan', {goal, history});
      if (generation !== current || !connected()) return;
      el('wsTermExplanation').textContent = result.explanation || '';
      el('wsTermCommand').textContent = Array.isArray(result.argv) ? result.argv.map(x => JSON.stringify(x)).join(' ') : '';
      if (!result.done && Array.isArray(result.argv) && typeof result.approval_id === 'string') { pending = {argv:result.argv, approval_id:result.approval_id}; status('راجع الأمر ثم وافق على تنفيذه.'); }
      else status('النموذج يعتبر المهمة مكتملة؛ راجع النتيجة.');
    } catch (error) { if (generation === current) status('فشل التخطيط: ' + String(error.message || error)); }
    finally { if (generation === current) { busy = false; controls(); } }
  });
  el('wsTermApprove').addEventListener('click', async () => {
    if (!pending) return;
    const proposal = pending; pending = null; busy = true; controls();
    const current = generation;
    try {
      const result = await api('/api/agent/execute', {argv:proposal.argv, approval_id:proposal.approval_id, approved:true});
      if (generation !== current || !connected()) return;
      const output = 'exit_code=' + result.exit_code + '\n' + result.output + (result.truncated ? '\n[truncated]' : '');
      el('wsTermResult').textContent = output;
      history.push({argv:proposal.argv, result:output.slice(0,4000)}); history = history.slice(-8);
      status('اكتمل الأمر؛ راجع النتيجة قبل الخطوة التالية.');
    } catch (error) { if (generation === current) status('فشل التنفيذ: ' + String(error.message || error)); }
    finally { if (generation === current) { busy = false; controls(); } }
  });
  if (['localhost','127.0.0.1'].includes(location.hostname)) el('wsTermEndpoint').value = location.origin;
  controls();
})();
