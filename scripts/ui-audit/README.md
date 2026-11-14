# UI audit in a real browser

The repository's UI tests are string and contract checks. They cannot see a
control that renders off screen or stretches over the page. This opt-in tool
opens the real pages in Chromium and measures them.

It is **not** part of CI: it needs Playwright with Chromium, which the project
does not depend on.

```sh
# 1. Build the Sentinel bundle the preview serves (embeds GSAP/Lenis locally).
npm --prefix wormstar-ui ci --ignore-scripts
npm --prefix wormstar-ui run build

# 2. Start the local preview of both Workers (Sentinel :8801, Core :8802).
node scripts/ui-audit/serve.mjs &

# 3. Run the audit (needs `playwright` resolvable by Node, with Chromium installed).
node scripts/ui-audit/audit.mjs ui-audit-output

# 4. The build rewrote wormstar-ui/worker.js; do not commit that.
git checkout -- wormstar-ui/worker.js
```

For 320, 390, 768 and 1440px it visits every Sentinel page plus `/osint/`,
`/audit/`, the NEXUS login gate, `/workspace`, `/academy` and `/suite/`, and
reports horizontal overflow, controls outside the viewport, fixed controls
taller than half the screen, console/page errors, failed requests and text
under 10.5px. It then checks the motion layer: smooth scrolling on a
fine-pointer desktop only, none for touch or reduced motion, and no leftover
ScrollTriggers, tweens or inline opacity after 40 page switches. Screenshots
and `report.json` go to the output directory.

Limits: the preview has no owner session, D1, Vectorize or AI binding, so
nothing behind the login is rendered and no live terminal WebSocket is
exercised. Headless Chromium is not iPhone Safari; treat a clean run as
necessary, not sufficient, before a production merge.
