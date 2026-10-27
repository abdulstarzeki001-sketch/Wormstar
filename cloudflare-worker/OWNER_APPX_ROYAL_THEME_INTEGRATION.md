# Wormstar v45 — owner ZIP integration audit (2026-10-28)

## Uploaded archive

- Original uploaded file: `wormgpt.appx.zip`
- Archive SHA-256: `8eda21b383d6277e087ae1509f2555c6a9eb55503421a7e6ee1c27f46494743c`
- Archive size: 1,634,027 bytes. 37 ZIP directory entries; 19 meaningful extracted files after discarding macOS `__MACOSX` metadata.
- Extracted sources include `chat.html` (588,510 bytes), 11 JavaScript files, 3 promotional SVG files, a WebP logo, a PNG thumbnail, and a local downloads index.
- `chat.html` includes **50 inline CSS blocks totaling 231,902 characters** and references extra hosted stylesheets that were not present in the uploaded archive.
- The archive contains no proprietary inference weights. It is HTML/CSS/JavaScript frontend reference material, not an independently deployable WormGPT backend.

## Design patterns extracted (and adapted as original Wormstar code)

The owner-provided HTML includes a "Royal Luxury" and "Blood Glass" palette. Reference colors are deep burgundy-black (`#070407`), raised burgundy (`#120810`), royal red (`#e5003c`) and soft pale-red text accents. The original file also contains 50 CSS blocks spanning navigation, chat composer, code-box layout, login, account panels, motion and mobile breakpoints.

For compatibility with the existing RTL Arabic dashboard, these patterns were **re-implemented in first-party Wormstar CSS**, rather than loading the 231KB of vendor selectors globally. The new default **Royal Blood Glass** variant retains the existing `crimson` palette identifier, reworks typography, highlights, sidebar, login, home, chat, code, knowledge, studio, cloud, OpenClaw and OpenCode panels, command palette and mobile dock, and keeps Ember/Amethyst/Aurora as alternatives. The theme preference key is now `wormstar-visual-theme-v3` so existing previous-theme choices do not prevent the new default from appearing.

The real chat renderer now formats fenced code blocks with an inline language/line-count header and a clipboard copy button, inspired by the archive's `wg-code-ide`/code-box UI. **Code is always placed in DOM nodes through `textContent` and never evaluated or rendered as HTML.** Non-fenced content stays plain text and retains the app's original behavior.

App manifest background and theme color match `#070407`. The mobile drawer breakpoint is aligned at 760px, preserving internal chat scrolling and safe area behavior.

## Source-code audit and exclusions

No original uploaded JavaScript was executed in the privileged owner Worker. Files not imported into production:

- `wg-realtime*.js` and `wg-voice*.js`: depend on provider-specific streaming endpoints and microphone permissions; integrating them without a verified backend would be misleading and could send audio externally.
- `wg-device-fingerprint*.js` and `fingerprintjs*.js`: involve browser/device identification and are unnecessary for UI consistency.
- `wg-profile*.js`: relies on a different application's profile API.
- `wg-iconify*.js`: references SVG icon paths and selectors not present in Wormstar; icons therefore remain first-party.
- Duplicated minified code-highlighting vendor bundles totaling approximately 6.6MB uncompressed: not copied; full bundling would waste Worker capacity and does not integrate with the current plaintext chat renderer.
- `wormgpt-logo.png.webp` and promotional SVGs: kept in the local extracted review only; they identify a different brand and are not adopted as Wormstar branding.
- The extra stylesheets referenced by `chat.html` were **not in the archive** and were not fetched or represented as inspected.

## Deployment safety

This is a presentation and first-party text-rendering update only. Cloudflare Access, server-side authorization, Workers AI routing, Supabase connection policy, D1 memory and archives, OpenClaw/OpenCode access controls and API contracts are not changed. No database migrations or destructive operations.

Automated checks: `cloudflare-worker/tests/upload-theme.test.mjs`, plus the repository's full test workflows. A real authenticated phone/browser acceptance pass remains necessary before claiming pixel-perfect visual parity with the supplied site.
