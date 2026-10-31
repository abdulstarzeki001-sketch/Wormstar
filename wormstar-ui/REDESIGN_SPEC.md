# Wormstar Sentinel — UI Redesign

## Direction
A new product shell, not a restyle of the legacy dashboard. The interface uses a premium security-operations aesthetic: deep ink surfaces, restrained electric teal, signal violet, warm amber for caution, and high-contrast ivory text. It avoids terminal-green clichés and decorative hacker imagery.

## Responsive experience
- Desktop (>= 1050px): RTL primary navigation rail, central workspace, contextual right rail.
- Tablet (721–1050px): navigation rail + fluid content; context rail collapses.
- Mobile (<= 720px): compact top bar, full-width content, bottom five-destination navigation, drawer for secondary modules, safe-area padding.
- Arabic RTL by default with explicit English LTR switch.
- Dark default theme with a light theme toggle.
- Installable PWA shell and conservative offline cache for the static interface only.

## Information architecture
1. Overview
2. AI Assistant
3. Code Review
4. Incidents & Alerts
5. IOC Analysis
6. Training Lab
7. Reports
8. AI Agents
9. Settings

## Interaction contract
Navigation, language direction, theme, local IOC syntax preview, message composition prototype, demo notices and Markdown report-template export work in this standalone UI.
The AI prompt, file upload, security scans, agent orchestration, authentication, live telemetry, report generation and audit storage remain intentionally unconnected until their existing backend APIs and authorization controls are mapped and verified. No live operation is claimed by the UI.

## Design tokens
- Ink: #0A101D
- Surface: #111A2A
- Raised surface: #172337
- Primary text: #EDF3FA
- Muted text: #91A2B9
- Electric teal: #52E0C2
- Signal violet: #A69AFF
- Caution amber: #EEBC76
- Danger: #FF7888
- Positive: #63D6A7

## Migration safeguards
- Keep the legacy interface and its source files untouched during review.
- Integrate this UI as a separate frontend entry point first.
- Map each existing API and authorization flow before wiring controls.
- Test desktop, tablet, small phone, RTL and LTR.
- Deploy to a separate Cloudflare preview Worker before changing production routes.
- Switch production only after visual, functional, security and accessibility review.
