# Wormstar AI Lab — cloud companion

This directory adds a **separate, owner-protected cloud interface** for the existing Wormstar repository. The original Python and Ollama files in the repository root are **not changed**.

## Current features

- Arabic RTL responsive security-research dashboard.
- Six analysis modes: general cybersecurity assistant, source-code review, log triage, IOC triage, CTF education, and report drafting.
- AppDeploy-managed AI via backend-only AI generation, with deep reasoning.
- AppDeploy sign-in and **owner-email allowlist** on both API endpoints.
- Client-side IOC previews for pasted IPs, URLs and SHA-256 hashes (no network access).
- Markdown export of the active conversation.
- No remote shell, arbitrary Python execution, live scanning or connection to user targets.

## Deployment requirements

1. Create a new AppDeploy app using **frontend+backend** and **react-vite**.
2. Use the files in this directory as the application source. AppDeploy injects its client and server SDKs; do **not** add these SDKs to package.json.
3. In AppDeploy, create a **backend secret** named WORMSTAR_OWNER_EMAIL containing the email address of the intended owner. **Without this setting all private API requests are denied.** Never commit the owner's email or API keys to GitHub.
4. Enable AppDeploy authentication. The owner must sign in using the same email address.
5. Deploy and verify the healthcheck, owner sign-in, a real AI analysis and Markdown export. QA owner-only tests require an authorized test account.
6. Optionally attach a custom domain. The hosted URL is stable while the application and hosting account remain active; 24/7 uptime is subject to hosting quotas and service availability.

The public landing page can be viewed by anyone with the URL; AI operations are accessible only after authentication and owner verification.

## Architecture

- Frontend: React, Vite, TypeScript, Lucide, CSS.
- Backend: AppDeploy serverless router and managed text-generation API.
- Auth: AppDeploy OAuth/email authentication plus backend owner allowlist.
- Persistence: current chat is **in-memory for this browser session** and can be exported. It is not a permanent knowledge store.
- AI: **managed inference**. This does not self-host the local Ollama weights or train a proprietary model. A dedicated private inference server would be a separate infrastructure phase.

## Integrations not yet configured

GitHub, Notion, Firecrawl, Parallel Search, Postman, Cloudflare, Neon, Supabase, Figma, TinyFish, Floot, and other connectors each require explicit integration design, access authorization and credentials. They are **not automatically connected to the deployed app** merely because they are available in ChatGPT.

## Operational scope

This cloud interface is a text-analysis lab for authorized cybersecurity work. It does not publish the original local Python/Bash command runners to the internet. The existing CLI remains available separately under its original README instructions.
