# WORMSTAR ONE — Frontend Engineering Audit & Integration Report

**Date:** 2026-11-14
**Base:** main @ 664065d906c4c446346c5c13b22031114f9ac28b
**Branch:** feat/wormstar-ui-engineering-20261114
**Release policy:** Pull request only. Do not merge or deploy until reviewed and verified.

## 1. Actual architecture and baseline

| Surface | Source | Framework | Production relationship |
|---|---|---|---|
| AI Lab/NEXUS | cloudflare-worker/worker.js, redesign-ui.js, future-ui.js | HTML/CSS/vanilla JS inside Cloudflare Worker | Current AI Lab Worker |
| Workspace | cloudflare-worker/unified-workspace.js | HTML/CSS/vanilla JS | /workspace on AI Lab |
| Academy | cloudflare-worker/academy-page.js | HTML/CSS/vanilla JS | /academy on AI Lab |
| Suite entrypoint | cloudflare-worker/unified-suite-proxy.js | Cloudflare Worker | /suite/ |
| OSINT/Audit | wormstar-ui/osint-worker.js and audit-worker.js | HTML/CSS/vanilla JS | Sentinel Worker, service-bound to Core |
| Sentinel main console | wormstar-ui/index.html, motion.js, motion.css | HTML/CSS/vanilla JS | Separate Sentinel Worker |
| React prototype | cloud-app/src/Lab.tsx | React 19, Vite 6, TypeScript | Separate app scaffold, NOT the core deployed Worker |
| Linux Terminal | abdulstarzeki001-sketch/linux-terminal | xterm.js, WebSocket, Bash, Railway | Reached by /terminal/ Cloudflare proxy |

**Build tools:** npm. The two Workers are not React apps and should not acquire an entire React/Vite/Tailwind stack. The separate cloud-app contains React/Vite/TypeScript; Tailwind is NOT a dependency in its inspected package.json. Sentinel already has pinned \`gsap@3.15.0\` and \`lenis@1.3.27\` in package-lock.json, with first-party assets produced by \`scripts/build-worker.mjs\`. No package installation or cloning is required for the existing Sentinel motion layer.

## 2. Changes in this PR

### Cloudflare AI Lab, NEXUS and Academy
- Added **ui-engineering.js**: one shared, idempotent static HTML/CSS enhancement for these real pages; DOM/event listeners and auth code remain unchanged. Validated the HTML insertion and corrected Workspace's nested `nav` landmark to an accessible `div` group within its existing navigation.
- Introduced first-party \`/ui/engine.js\` animation controller and allowlisted pinned vendor bundle endpoints \`/ui/vendor/{gsap.min.js,ScrollTrigger.min.js,lenis.min.js}\`.
- The vendor assets are read from the **existing same-account SENTINEL_SUITE Cloudflare Service Binding**, avoiding external third-party script origins. If the binding is down, UI remains readable and native navigation continues.
- Added compact, responsive card spacing, safe text wrapping, keyboard focus outlines and subtle spotlight hover. No invented telemetry or synthetic status values.
- GSAP animates visible headings and a bounded number of cards, and kills tweens/ScrollTriggers when switching the active section or leaving the page. No hidden content when JS is unavailable.
- Lenis uses GSAP ticker + ScrollTrigger when scrolling the *document* on fine-pointer devices only. It deliberately skips mobile coarse touch, reduced-motion users, Terminal, editor, Logs, dialogues and nested scrollable panes. WebSocket, HTTP, auth and data processing are untouched.
- Added relative, **same-origin** quick links to Suite / Terminal / OSINT / Audit inside the Workspace sidebar.
- Updated the three relevant page CSPs to allow only the existing self-hosted bundles (\`script-src 'self' 'unsafe-inline'\`); no remote JS hosts enabled. Other API/security CSPs unchanged.

### Sentinel
- Reuses the already pinned GSAP+Lenis bundles. Enhanced report and metric panel transitions and panel spotlight under fine pointer.
- Expanded native-scroll exclusion to xterm, editors, logs and nested views. No changes to terminal.js or auth.
- Existing fallback remains native CSS/JS when animation assets cannot load.

### React prototype
- Added a small authored \`SpotlightCard\` TypeScript/React component and applied it without modifying DOM structure or access checks to the existing authentication orb and active-mode icon.
- Added CSS-only spotlight and reduced-motion focus styling without installing React Bits or mixing React into the Workers.

### 21st.dev / Claude MCP
- 21st is a **development-time** design source, not a production runtime dependency. No API key or MCP credential is checked into the repo.
- To connect in **Claude Code**, obtain your own \`API_KEY_21ST\` from https://21st.dev/settings/api-keys, store it in a secure shell secret manager or local environment, then use:
  1. \`/plugin marketplace add 21st-dev/claude-code-plugin\`
  2. \`/plugin install 21st@21st\`
  3. Restart Claude Code and verify with \`/mcp\`; search/select UI components suitable for the actual React Vite scaffold.
- Manual setup is still necessary; **this PR does not claim the MCP connection is active**. Avoid committing a real 21st API key, and review the license of each retrieved component individually.

## 3. Licensing and compatibility

| Source | Status / license | Scope in this PR |
|---|---|---|
| GSAP | GreenSock standard no-charge license; current Sentinel pin v3.15.0 | Reuse existing npm-pinned first-party UMD bundle |
| Lenis | MIT; existing Sentinel v1.3.27 | Reuse existing npm-pinned first-party bundle |
| React Bits | MIT + Commons Clause | Design inspiration only; no third-party source copied or dependency added |
| 21st.dev plugin | Separately installed Claude Code plugin requiring API key | Setup instructions only; no unauthorized credentials or fetched components |

Official references:
- https://gsap.com/docs/v3/Installation/
- https://github.com/darkroomengineering/lenis
- https://github.com/DavidHDev/react-bits
- https://github.com/21st-dev/claude-code-plugin

## 4. Validation checklist

| Check | How to run | Result |
|---|---|---|
| Core Worker syntax/permissions/test suite | \`cd cloudflare-worker && npm test\` | **Passed on PR head 56f39eb (GitHub Actions)** |
| Sentinel frontend build and runtime tests | \`cd wormstar-ui && npm ci && npm test\` | **Pending CI** |
| Three Core page templates and same-origin resource contract | \`cd cloudflare-worker && node --test tests/ui-engineering.test.mjs\` | **Pending CI** |
| UI behavior and motion contract | \`cd wormstar-ui && node --test scripts/test-motion.mjs scripts/test-ui-behavior.mjs\` | **Pending CI** |
| React Vite build/typecheck | \`cd cloud-app && npm install && npx tsc --noEmit && npm run build\` | Not executed; separate app uses \`@appdeploy/client\` SDK not listed in package.json, and should be validated in its configured build environment |
| Real iPhone navigation / terminal WebSocket / keyboard | Manual browser test in authenticated owner session | Not executed |
| Production deployment | Forbidden for this PR | Not executed |

**Regression scenario:** visit \`/suite/\`, \`/workspace\`, \`/osint/\`, \`/audit/\`, and \`/terminal/\` from the original AI Lab host. Ensure the address bar stays on that host. Confirm Railway original password still governs shell sessions. Check the OSINT and Audit panels with locally supplied data and no fake entries. Confirm tab navigation, RTL, 320px and 390px Safari, >=1280px desktop, pointer hover, keyboard focus and \`prefers-reduced-motion\`.

**Review warning:** \`/ui/vendor/*\` depends on the pinned first-party Sentinel deployment binding. The Core motion layer deliberately fails open to native scrolling and readable content if those optional assets fail. Do not change authentication, cookies, tokens, service bindings or WebSocket gateway merely to support UI effects.


## 5. Verified GitHub Actions outcomes

All **9 jobs** in Wormstar Quality Gate run [43520752214](https://github.com/abdulstarzeki001-sketch/Wormstar/actions/runs/43520752214) passed at PR revision 56f39eb6bdaa522aa0316baa45b22eaf05acf215:
Core + Policy + RAG, Sentinel + Same-Origin Audit, Commit-Scoped Security,
STAR OSINT Offline Tests, Private Terminal, Cloud Terminal Contract,
Docker Terminal Smoke, UBOOR Offline Lab, iSH Analyzer/Report Schema.

**Exact scope:** CI validates JavaScript Worker syntax/contract tests and the Sentinel bundled npm build; it does **not** validate real iPhone Safari rendered layout, a live Railway password login, cross-Worker live WebSocket, or cloud-app React/Vite TypeScript build. No standalone ESLint, React typecheck, or Cloudflare production deployment was run as part of the UI change. Those remain manual review gates.

**Change control:** Keep this PR open and unmerged. The tests are evidence of correctness within their scope, not a guarantee that every production page has been visually verified.
