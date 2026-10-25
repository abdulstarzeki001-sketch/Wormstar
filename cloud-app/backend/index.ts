import {
  ai,
  error,
  json,
  requireAdminEmailAllowlist,
  requireAuth,
  router,
  withScopes,
} from '@appdeploy/sdk';

type Mode = 'assistant' | 'code' | 'logs' | 'ioc' | 'ctf' | 'report';

const OWNER_EMAIL = (process.env.WORMSTAR_OWNER_EMAIL || '').trim().toLowerCase();
const ownerOnly = requireAdminEmailAllowlist(OWNER_EMAIL ? [OWNER_EMAIL] : []);

const INSTRUCTIONS: Record<Mode, string> = {
  assistant: 'You are Wormstar AI Lab, a professional Arabic-speaking cybersecurity research assistant. Help with authorized security assessments, threat modeling, hardening, defensive analysis, and clear explanations.',
  code: 'Review the pasted source code for security defects. Give severity, affected code, realistic impact, and a minimal suggested patch. Never claim to have executed or scanned the code.',
  logs: 'Analyze user-supplied logs for anomalies, probable causes, incident timelines, and defensive next steps. Distinguish observations from hypotheses.',
  ioc: 'Analyze indicators of compromise supplied as text. Extract and categorize hashes, domains, IPs and URLs, explain uncertainty, and propose defensive triage. Do not contact indicators.',
  ctf: 'Be a cybersecurity education tutor for sandboxed CTF challenges. Explain reasoning and teach concepts within a controlled lab, without targeting third-party systems.',
  report: 'Create a concise professional security assessment or incident report in Arabic with scope, evidence, findings, severity, uncertainty and recommended remediation.',
};

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(INSTRUCTIONS, value);
}

export const handler = router({
  'GET /api/_healthcheck': [
    async () => json({ ok: true, service: 'wormstar-ai-lab' }),
  ],

  'GET /api/session': [
    requireAuth(),
    withScopes('email'),
    ownerOnly,
    async (ctx) => json({ authorized: true, email: ctx.user!.email }),
  ],

  'POST /api/assist': [
    requireAuth(),
    withScopes('email'),
    ownerOnly,
    async (ctx) => {
      const body = ctx.body as Record<string, unknown> | null;
      if (!body || !isMode(body.mode)) {
        return error('Invalid analysis mode', 400);
      }

      const message = body.message;
      if (typeof message !== 'string' || !message.trim() || message.length > 16000) {
        return error('Message must contain 1 to 16000 characters', 400);
      }

      const history = Array.isArray(body.history) ? body.history : [];
      const recent = history.slice(-6).flatMap((item: unknown) => {
        if (!item || typeof item !== 'object') return [];
        const entry = item as Record<string, unknown>;
        if (
          (entry.role !== 'user' && entry.role !== 'assistant') ||
          typeof entry.content !== 'string' ||
          entry.content.length > 6000
        ) {
          return [];
        }
        return [{ role: entry.role, content: entry.content }];
      });

      try {
        const result = await ai.generate({
          system: INSTRUCTIONS[body.mode] +
            ' Operate as a text-only analysis assistant. Do not run code, browse, scan targets, access local files or claim tool execution. Only assess assets within the user-authorized scope. Do not assist phishing, malware deployment, credential theft or unauthorized intrusion. Clearly label assumptions and limitations.',
          messages: [...recent, { role: 'user', content: message.trim() }],
          maxTokens: 1800,
          temperature: 0.2,
          thinkingMode: 'DEEP',
        });

        return json({ answer: result.text, mode: body.mode });
      } catch (cause) {
        console.error('Wormstar AI generation failed', cause);
        return error('AI service is temporarily unavailable', 503);
      }
    },
  ],
});
