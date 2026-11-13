# Wormstar Sentinel — GSAP / Lenis motion integration

## What is implemented

The existing Sentinel frontend is **vanilla HTML/CSS/JavaScript** bundled as a Cloudflare Worker with a private Core binding. It is not a React/Vite app. This change deliberately **does not migrate to React** or alter existing API, auth, OSINT, or terminal contracts.

- **GSAP 3.15.0**: small page heading entrances and cards that animate into view through ScrollTrigger.
- **Lenis 1.3.27**: optional smooth native scrolling on devices with a fine pointer; touch devices use native scrolling. GSAP's ticker drives the Lenis instance, and ScrollTrigger is synchronized.
- **React Bits** (https://github.com/DavidHDev/react-bits): visual reference for a low-cost spotlight-card interaction; implemented natively in `motion.css` / `motion.js` for existing DOM cards. **No React Bits React code or package is installed**, because there is no React runtime.
- **21st.dev** (https://21st.dev and https://github.com/21st-dev/claude-code-plugin): reference for component design and agent-assisted research. **21st MCP is not connected through this code change**; the user must configure the 21st plugin in Claude Code separately. Do not commit `API_KEY_21ST`.

## Deployment and architecture

Run `npm ci` in `wormstar-ui` before `npm test`, `npm run build`, or Wrangler deploy. The build script embeds four pinned, first-party vendor artifacts and two project motion files into `worker.js`, then exposes:

- `/assets/gsap.min.js`
- `/assets/ScrollTrigger.min.js`
- `/assets/lenis.min.js`
- `/assets/lenis.css`
- `/motion.js`
- `/motion.css`

The browser requests assets from the **same origin**. No third-party JavaScript CDN permission is added to the CSP. `cloudflare-worker/` and its security policy are not changed.

## UX and safety

- Reduced-motion preference disables optional animations and Lenis.
- Fine-pointer-only smoothing means iOS/Android keep native touch scrolling, with `syncTouch: false` and nested scroll opt-outs.
- No animation is applied to terminal output, logs, editor text, chat history, or code input.
- The motion layer does not send network requests or read authentication tokens.
- Page changes are detected from the existing `.page.active` class; the old navigation, keyboard, session and API event handlers remain intact.
- A script failure leaves the markup visible; there is no permanent CSS `opacity: 0` gate.
- CSS spotlights affect presentation only; fake metrics remain visibly illustrative until connected to actual data.

## 21st.dev integration for Claude Code, if desired later

Set `API_KEY_21ST` **outside GitHub**, then in Claude Code run:

```text
/plugin marketplace add 21st-dev/claude-code-plugin
/plugin install 21st@21st
/mcp
```

Review the returned component's framework, licenses and dependencies **before** importing it into this vanilla-JS frontend. For React Bits/21st React components, create a reviewed, separate React island only if there is a concrete feature requiring it.

## Validation

CI installs dependencies with `npm ci --ignore-scripts` and runs `npm test`. This includes syntax, HTTP route checks, CSP/auth regressions, reduced-motion and first-party asset checks. Test real devices before any production merge.

**Production is unchanged until PR review and explicit deployment approval.**
