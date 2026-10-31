import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, auth } from '@appdeploy/client';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Code2,
  Download,
  Fingerprint,
  Flag,
  LogOut,
  MessageSquare,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import './lab.css';

type Mode = 'assistant' | 'code' | 'logs' | 'ioc' | 'ctf' | 'report';
type Access = 'checking' | 'signedout' | 'authorized' | 'denied';
type Message = { id: number; role: 'user' | 'assistant'; content: string; mode: Mode };

const MODES = [
  { id: 'assistant', label: 'المساعد الذكي', sub: 'تحليل وبحث أمني', icon: BrainCircuit },
  { id: 'code', label: 'تدقيق الأكواد', sub: 'مراجعة الثغرات', icon: Code2 },
  { id: 'logs', label: 'تحليل السجلات', sub: 'استجابة للحوادث', icon: Activity },
  { id: 'ioc', label: 'مؤشرات الاختراق', sub: 'تحليل IOC', icon: Fingerprint },
  { id: 'ctf', label: 'مختبر CTF', sub: 'تحديات تدريبية', icon: Flag },
  { id: 'report', label: 'التقارير', sub: 'تقارير فنية', icon: ClipboardList },
] as const;

const EXAMPLES: Record<Mode, string[]> = {
  assistant: [
    'صمّم خطة اختبار اختراق مصرح به لتطبيق ويب',
    'اشرح الفرق بين SAST و DAST',
    'أنشئ نموذج تهديدات لتطبيق SaaS',
  ],
  code: [
    'راجع هذا الكود بحثاً عن SQL injection',
    'حلل إدارة الجلسات في هذا المقطع',
    'اقترح إصلاحاً لتسريب أسرار API',
  ],
  logs: [
    'حلّل محاولات تسجيل الدخول غير المعتادة',
    'كوّن خطاً زمنياً من سجلات الحادث',
    'ميّز الإنذارات الحقيقية من الإيجابيات الكاذبة',
  ],
  ioc: [
    'صنّف مؤشرات الاختراق الموجودة في النص',
    'حلّل هذه الـ hashes والعناوين دون الاتصال بها',
    'اكتب خطوات triage لمؤشرات مشبوهة',
  ],
  ctf: [
    'اشرح طريقة التفكير في تحدي Web CTF',
    'علّمني تحليل ملفات PCAP في مختبر',
    'ساعدني في تحدي تشفير تدريبي',
  ],
  report: [
    'أنشئ تقرير تقييم أمني من هذه النتائج',
    'اكتب تقرير استجابة لحادث',
    'رتّب النتائج حسب الشدة والأولوية',
  ],
};

const PLACEHOLDERS: Record<Mode, string> = {
  assistant: 'اكتب سؤالك أو مهمتك في الأمن السيبراني...',
  code: 'الصق الكود المطلوب مراجعته، مع وصف السياق...',
  logs: 'الصق السجلات أو الأحداث المطلوب تحليلها...',
  ioc: 'الصق عناوين IP أو الروابط أو الـ hashes...',
  ctf: 'اكتب وصف تحدي CTF التدريبي...',
  report: 'أدخل النتائج والأدلة لتوليد تقرير احترافي...',
};

export default function Lab() {
  const [access, setAccess] = useState<Access>('checking');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [mode, setMode] = useState<Mode>('assistant');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!auth.isSignedIn()) {
        if (active) setAccess('signedout');
        return;
      }
      try {
        const response = await api.get('/api/session');
        if (active) {
          setEmail(String(response.data.email || ''));
          setAccess('authorized');
        }
      } catch {
        if (active) setAccess('denied');
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  const activeMode = MODES.find((item) => item.id === mode)!;
  const visibleMessages = messages.filter((message) => message.mode === mode);
  const indicatorPreview = useMemo(() => {
    if (mode !== 'ioc') return [];
    const matches = [
      ...input.matchAll(/https?:\/\/[^\s"'<>]+/gi),
      ...input.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g),
      ...input.matchAll(/\b[a-f0-9]{64}\b/gi),
    ].map((match) => match[0]);
    return Array.from(new Set(matches)).slice(0, 12);
  }, [input, mode]);

  async function signIn() {
    setAuthError('');
    try {
      await auth.signIn();
      const response = await api.get('/api/session');
      setEmail(String(response.data.email || ''));
      setAccess('authorized');
    } catch (cause) {
      const issue = cause as { code?: string };
      if (issue.code === 'popup_closed') return;
      setAuthError(
        issue.code === 'popup_blocked'
          ? 'اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
          : 'هذا الحساب غير مصرح له بدخول المختبر، أو لم يُضبط بريد المالك بعد.'
      );
      setAccess(auth.isSignedIn() ? 'denied' : 'signedout');
    }
  }

  async function signOut() {
    await auth.signOut();
    setEmail('');
    setMessages([]);
    setAccess('signedout');
    setAuthError('');
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy || access !== 'authorized') return;
    const previous = messages
      .filter((item) => item.mode === mode)
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));

    setMessages((items) => [
      ...items,
      { id: Date.now(), role: 'user', content: prompt, mode },
    ]);
    setInput('');
    setError('');
    setBusy(true);

    try {
      const response = await api.post('/api/assist', {
        mode,
        message: prompt,
        history: previous,
      });
      const answer = response.data?.answer;
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('Empty model response');
      }
      setMessages((items) => [
        ...items,
        { id: Date.now() + 1, role: 'assistant', content: answer, mode },
      ]);
    } catch {
      setError('تعذر الحصول على إجابة. تحقق من الخدمة وحاول مجدداً.');
      setInput(prompt);
    } finally {
      setBusy(false);
    }
  }

  function downloadReport() {
    const content = visibleMessages
      .map(
        (item) =>
          (item.role === 'user' ? '## السؤال' : '## التحليل') +
          '\n\n' +
          item.content
      )
      .join('\n\n---\n\n');
    const text =
      '# Wormstar AI Lab\n\n' +
      activeMode.label +
      '\n\n' +
      content +
      '\n\n> نتائج تحليل نصي، وليست إثباتاً على إجراء فحص مباشر.\n';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wormstar-' + mode + '-report.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app" dir="rtl">
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />

      <header className="topnav">
        <div className="topnav-inner">
          <div className="brand">
            <div className="brand-mark">
              <Shield size={20} strokeWidth={2.2} />
            </div>
            <div className="brand-text">
              <span className="brand-name">Wormstar</span>
              <span className="brand-tag">AI Lab</span>
            </div>
          </div>

          {access === 'authorized' && (
            <nav className="mode-pills" aria-label="أقسام المختبر">
              {MODES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={'pill' + (mode === item.id ? ' active' : '')}
                    onClick={() => {
                      setMode(item.id);
                      setError('');
                    }}
                    title={item.sub}
                  >
                    <Icon size={15} strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="topnav-right">
            {access === 'authorized' ? (
              <>
                <span className="user-chip">
                  <CheckCircle2 size={14} />
                  <span>{email}</span>
                </span>
                <button type="button" className="icon-btn" onClick={() => void signOut()} title="خروج">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <span className="status-chip">
                <span className="status-dot" />
                مساحة خاصة
              </span>
            )}
          </div>
        </div>
      </header>

      {access !== 'authorized' ? (
        <main className="auth-screen">
          <div className="auth-card">
            <div className="auth-orb">
              <Shield size={32} strokeWidth={1.8} />
            </div>
            <p className="auth-kicker">Private Cybersecurity Workspace</p>
            <h1>مختبر Wormstar</h1>
            <p className="auth-desc">
              واجهة تحليل أمني مدعومة بالذكاء الاصطناعي.
              <br />
              الوصول مخصص لمالك المختبر فقط.
            </p>

            {access === 'checking' ? (
              <div className="auth-loading">
                <span className="loader" />
                جارٍ التحقق من الجلسة...
              </div>
            ) : (
              <>
                <button className="btn-primary large" type="button" onClick={() => void signIn()}>
                  <Zap size={18} />
                  تسجيل الدخول
                </button>
                {access === 'denied' && (
                  <p className="auth-alert">
                    الحساب الحالي غير مخوّل. يمكنك تسجيل الخروج واستخدام حساب المالك.
                  </p>
                )}
                {access === 'denied' && (
                  <button type="button" className="btn-text" onClick={() => void signOut()}>
                    تغيير الحساب
                  </button>
                )}
                {authError && (
                  <p role="alert" className="auth-alert">
                    {authError}
                  </p>
                )}
              </>
            )}

            <div className="auth-footer">
              <Shield size={14} />
              تحليل نصي فقط — بدون تنفيذ أوامر على الخادم
            </div>
          </div>
        </main>
      ) : (
        <main className="workspace">
          <section className="mode-header">
            <div className="mode-info">
              <div className="mode-icon">
                <activeMode.icon size={22} strokeWidth={1.8} />
              </div>
              <div>
                <h1>{activeMode.label}</h1>
                <p>{activeMode.sub} — مساعد لتحليل الأدلة والنصوص ضمن نطاق مصرح به.</p>
              </div>
            </div>
            <div className="mode-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={visibleMessages.length === 0}
                onClick={downloadReport}
              >
                <Download size={16} />
                تصدير
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={visibleMessages.length === 0 || busy}
                onClick={() =>
                  setMessages((items) => items.filter((item) => item.mode !== mode))
                }
              >
                <RotateCcw size={15} />
                جلسة جديدة
              </button>
            </div>
          </section>

          <section className="chat-panel">
            <div className="messages" aria-live="polite">
              {visibleMessages.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <MessageSquare size={28} strokeWidth={1.6} />
                  </div>
                  <h2>كيف أقدر أساعدك اليوم؟</h2>
                  <p>
                    اختر مهمة جاهزة أو أدخل النص المراد تحليله.
                    <br />
                    لن يتم تنفيذ أوامر أو إجراء فحوص نشطة.
                  </p>
                  <div className="suggestions">
                    {EXAMPLES[mode].map((example) => (
                      <button
                        type="button"
                        key={example}
                        className="suggestion"
                        onClick={() => setInput(example)}
                      >
                        <Sparkles size={14} />
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {visibleMessages.map((item) => (
                <article
                  key={item.id}
                  className={'msg ' + item.role}
                >
                  <div className="msg-avatar">
                    {item.role === 'user' ? (
                      <span>أنت</span>
                    ) : (
                      <BrainCircuit size={18} />
                    )}
                  </div>
                  <div className="msg-body">
                    <span className="msg-label">
                      {item.role === 'user' ? 'أنت' : 'Wormstar AI'}
                    </span>
                    <div className="msg-content">{item.content}</div>
                  </div>
                </article>
              ))}

              {busy && (
                <div className="thinking">
                  <span className="thinking-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  جارٍ تحليل المحتوى...
                </div>
              )}
            </div>

            <div className="composer">
              {indicatorPreview.length > 0 && (
                <div className="ioc-preview">
                  <span>مؤشرات مكتشفة محلياً:</span>
                  {indicatorPreview.map((value) => (
                    <code key={value}>{value}</code>
                  ))}
                </div>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  {error}
                </div>
              )}
              <form className="compose-box" onSubmit={(event) => void send(event)}>
                <textarea
                  aria-label="نص التحليل"
                  placeholder={PLACEHOLDERS[mode]}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={16000}
                  rows={3}
                />
                <div className="compose-bar">
                  <span className="compose-hint">
                    <Shield size={14} />
                    تحليل دون تنفيذ • {input.length.toLocaleString('en-US')}/16000
                  </span>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={!input.trim() || busy}
                  >
                    {busy ? 'جارٍ التحليل...' : 'إرسال'}
                    <Send size={15} />
                  </button>
                </div>
              </form>
              <p className="disclaimer">
                لا تُدخل مفاتيح API أو كلمات مرور. مخرجات الذكاء الاصطناعي تحتاج تحققاً مستقلاً.
              </p>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
