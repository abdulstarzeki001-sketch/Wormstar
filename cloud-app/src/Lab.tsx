import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, auth } from '@appdeploy/client';
import {
  Activity,
  ArrowUpLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Code2,
  Download,
  Fingerprint,
  Flag,
  KeyRound,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Radar,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
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
  assistant: ['صمّم خطة اختبار اختراق مصرح به لتطبيق ويب', 'اشرح الفرق بين SAST و DAST', 'أنشئ نموذج تهديدات لتطبيق SaaS'],
  code: ['راجع هذا الكود بحثاً عن SQL injection', 'حلل إدارة الجلسات في هذا المقطع', 'اقترح إصلاحاً لتسريب أسرار API'],
  logs: ['حلّل محاولات تسجيل الدخول غير المعتادة', 'كوّن خطاً زمنياً من سجلات الحادث', 'ميّز الإنذارات الحقيقية من الإيجابيات الكاذبة'],
  ioc: ['صنّف مؤشرات الاختراق الموجودة في النص', 'حلّل هذه الـ hashes والعناوين دون الاتصال بها', 'اكتب خطوات triage لمؤشرات مشبوهة'],
  ctf: ['اشرح طريقة التفكير في تحدي Web CTF', 'علّمني تحليل ملفات PCAP في مختبر', 'ساعدني في تحدي تشفير تدريبي'],
  report: ['أنشئ تقرير تقييم أمني من هذه النتائج', 'اكتب تقرير استجابة لحادث', 'رتّب النتائج حسب الشدة والأولوية'],
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
    return () => { active = false; };
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
      setAuthError(issue.code === 'popup_blocked'
        ? 'اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
        : 'هذا الحساب غير مصرح له بدخول المختبر، أو لم يُضبط بريد المالك بعد.');
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

    setMessages((items) => [...items, {
      id: Date.now(), role: 'user', content: prompt, mode,
    }]);
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
      setMessages((items) => [...items, {
        id: Date.now() + 1, role: 'assistant', content: answer, mode,
      }]);
    } catch {
      setError('تعذر الحصول على إجابة. تحقق من الخدمة وحاول مجدداً.');
      setInput(prompt);
    } finally {
      setBusy(false);
    }
  }

  function downloadReport() {
    const content = visibleMessages.map((item) =>
      (item.role === 'user' ? '## السؤال' : '## التحليل') + '\n\n' + item.content
    ).join('\n\n---\n\n');
    const text = '# Wormstar AI Lab\n\n' + activeMode.label + '\n\n' + content +
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
    <div className="wormstar-app" dir="rtl">
      <aside className="ws-sidebar">
        <div className="ws-brand">
          <div className="ws-brand-mark"><ShieldCheck size={24} /></div>
          <div><strong>WORMSTAR</strong><span>AI SECURITY LAB</span></div>
        </div>
        <div className="ws-section-label">مساحة العمل</div>
        <nav className="ws-nav" aria-label="أقسام المختبر">
          {MODES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                className={'ws-nav-item ' + (mode === item.id ? 'active' : '')}
                key={item.id}
                onClick={() => { setMode(item.id); setError(''); }}
              >
                <Icon size={19} />
                <span><strong>{item.label}</strong><small>{item.sub}</small></span>
                {mode === item.id && <ChevronLeft size={16} className="ws-nav-chevron" />}
              </button>
            );
          })}
        </nav>
        <div className="ws-sidebar-bottom">
          <div className="ws-scope"><LockKeyhole size={16} /> أدوات التحليل النصي فقط، دون تنفيذ أوامر على الخادم</div>
          <a href="https://github.com/abdulstarzeki001-sketch/Wormstar" target="_blank" rel="noreferrer" className="ws-repo">
            <TerminalSquare size={17} /> المستودع الأصلي <ArrowUpLeft size={14} />
          </a>
        </div>
      </aside>

      <div className="ws-main">
        <header className="ws-topbar">
          <div className="ws-breadcrumb">WORMSTAR <ChevronLeft size={14} /> <strong>{activeMode.label}</strong></div>
          <div className="ws-top-actions">
            <span className="ws-online"><span className="ws-dot" /> مختبر سحابي</span>
            {access === 'authorized' && (
              <button type="button" className="ws-logout" onClick={() => void signOut()}>
                <LogOut size={16} /> خروج
              </button>
            )}
          </div>
        </header>

        {access !== 'authorized' ? (
          <main className="ws-auth-wrap">
            <div className="ws-auth-card">
              <div className="ws-auth-icon"><KeyRound size={28} /></div>
              <div className="ws-eyebrow">PRIVATE CYBERSECURITY WORKSPACE</div>
              <h1>مختبر Wormstar الخاص</h1>
              <p>واجهة تحليل أمني وذكاء اصطناعي. الوصول إلى أدوات الذكاء الاصطناعي مخصص لمالك المختبر.</p>
              {access === 'checking' ? (
                <div className="ws-muted">جارٍ التحقق من جلسة الدخول...</div>
              ) : (
                <>
                  <button className="ws-primary ws-login" type="button" onClick={() => void signIn()}>
                    <LockKeyhole size={18} /> تسجيل الدخول <ArrowUpLeft size={17} />
                  </button>
                  {access === 'denied' && <p className="ws-auth-warning">الحساب الحالي غير مخوّل. يمكنك تسجيل الخروج واستخدام حساب المالك.</p>}
                  {access === 'denied' && <button type="button" className="ws-text-button" onClick={() => void signOut()}>تغيير الحساب</button>}
                  {authError && <p role="alert" className="ws-auth-warning">{authError}</p>}
                </>
              )}
              <div className="ws-auth-foot"><ShieldCheck size={15} /> ملفات المشروع الأصلية غير معدّلة</div>
            </div>
          </main>
        ) : (
          <main className="ws-workspace">
            <section className="ws-intro">
              <div>
                <div className="ws-eyebrow"><Sparkles size={15} /> INTELLIGENCE WORKSPACE / {mode.toUpperCase()}</div>
                <h1>{activeMode.label}</h1>
                <p>{activeMode.sub} — مساعد لتحليل الأدلة والنصوص ضمن نطاق اختبار مصرح به.</p>
              </div>
              <div className="ws-intro-actions">
                <span className="ws-user"><CheckCircle2 size={16} /> {email}</span>
                <button type="button" className="ws-ghost" disabled={visibleMessages.length === 0} onClick={downloadReport}>
                  <Download size={17} /> تصدير Markdown
                </button>
                <button type="button" className="ws-ghost" disabled={visibleMessages.length === 0 || busy} onClick={() => setMessages((items) => items.filter((item) => item.mode !== mode))}>
                  <RotateCcw size={16} /> جلسة جديدة
                </button>
              </div>
            </section>

            <section className="ws-console">
              <div className="ws-console-head">
                <div><span className="ws-terminal-dot red" /><span className="ws-terminal-dot yellow" /><span className="ws-terminal-dot green" /></div>
                <span><Radar size={15} /> WORMSTAR / {mode}</span>
                <span className="ws-session-label">جلسة خاصة</span>
              </div>

              <div className="ws-messages" aria-live="polite">
                {visibleMessages.length === 0 && (
                  <div className="ws-empty">
                    <div className="ws-empty-icon"><MessageSquareText size={29} /></div>
                    <h2>كيف أقدر أساعدك اليوم؟</h2>
                    <p>اختر مهمة جاهزة أو أدخل النص المراد تحليله. لن يتم تنفيذ أوامر أو إجراء فحوص نشطة.</p>
                    <div className="ws-prompts">
                      {EXAMPLES[mode].map((example) => (
                        <button type="button" key={example} onClick={() => setInput(example)}>
                          {example}<ArrowUpLeft size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {visibleMessages.map((item) => (
                  <article key={item.id} className={'ws-message ' + item.role}>
                    <div className="ws-message-avatar">{item.role === 'user' ? <span>أنت</span> : <BrainCircuit size={19} />}</div>
                    <div><strong>{item.role === 'user' ? 'أنت' : 'Wormstar AI'}</strong><div className="ws-message-content">{item.content}</div></div>
                  </article>
                ))}
                {busy && <div className="ws-thinking"><span className="ws-pulse" /> جارٍ تحليل المحتوى...</div>}
              </div>

              <div className="ws-compose-wrap">
                {indicatorPreview.length > 0 && (
                  <div className="ws-ioc-preview">
                    <span>مؤشرات مكتشفة محلياً:</span>
                    {indicatorPreview.map((value) => <code key={value}>{value}</code>)}
                  </div>
                )}
                {error && <div className="ws-error" role="alert">{error}</div>}
                <form className="ws-compose" onSubmit={(event) => void send(event)}>
                  <textarea
                    aria-label="نص التحليل"
                    placeholder={PLACEHOLDERS[mode]}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    maxLength={16000}
                    rows={4}
                  />
                  <div className="ws-compose-footer">
                    <span><ShieldCheck size={15} /> تحليل دون تنفيذ أوامر • {input.length.toLocaleString('en-US')}/16000</span>
                    <button className="ws-primary" type="submit" disabled={!input.trim() || busy}>
                      {busy ? 'جارٍ التحليل...' : 'إرسال للتحليل'} <Send size={16} />
                    </button>
                  </div>
                </form>
                <div className="ws-disclaimer">لا تُدخل مفاتيح API أو كلمات مرور. مخرجات الذكاء الاصطناعي تحتاج تحققاً مستقلاً.</div>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
