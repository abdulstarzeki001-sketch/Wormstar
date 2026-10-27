# Wormstar v43 — Crimson chat-first interface

Visual research references: https://www.wormgpt.live/ and public historical WormGPT UI screenshots. These are design references only; Wormstar remains a separately branded product and does not claim to run WormGPT proprietary models.

## UX navigation

- After owner sign-in, land on **assistant** (unless a valid hash route was explicitly supplied).
- Desktop/right rail: prominent **New Chat**, search/command palette, saved chat-archive entry, analysis modes, studio and an overview link.
- Mobile: four anchored destinations — Chat, Code, Memory and Home — while studio settings remain accessible through the sidebar and command palette.
- Chat: contextual quick tabs for assistant, code, logs and knowledge library; normal messages/composer, model selector, cloud archive and file references are preserved.
- Keyboard: existing Ctrl/Cmd+K command palette.
- New chat still calls the existing native clear control; archived data is not deleted automatically. Archive entry expands the existing opt-in cloud archive controls and never fakes a list of server-side conversations.

## Visual tokens

Default `crimson` palette: background `#08090d`, surface `#141219`, accent `#ff3458`, secondary `#ff7b81`, text `#faf8fb`. Existing Ember, Amethyst and Aurora remain selectable. The browser-local theme key is now `wormstar-visual-theme-v2`; this resets the default to the requested style, while retaining user choice of alternate themes after selection.

Existing PWA metadata uses `#08090d` for dark browser chrome. The underlying application and secure API contract are not replaced.

## Mobile acceptance

- No horizontal page overflow at 320px or larger. Text inputs use 16px to avoid iOS focus zoom.
- Existing chat-mode fixed composer and internally scrolling message panel remain intact.
- Sidebar overlays and closes via existing drawer controls; mobile bottom dock hides when typing.
- Supports reduced motion, keyboard focus outlines, readable contrast and RTL labels.

## Integrity

- Only two first-party Worker source modules change: `future-ui.js` and `worker.js`; one corresponding test file is updated.
- Cloudflare Access, authorization, model routing, permissions, D1 records, Supabase RLS, and backup behavior are unchanged.
- Do not execute uploaded third-party minified JavaScript, import another app's global CSS reset, or copy third-party images and logos.
- `tests/upload-theme.test.mjs` verifies boot syntax, routes, palette, mobile safety and PWA metadata. The full GitHub Actions suite must pass prior to merging.
- A full authenticated browser smoke test is recommended but should not be represented as completed without session-backed evidence.
