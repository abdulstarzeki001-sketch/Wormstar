# Wormstar Integration Hub

This directory contains a standalone Cloudflare Worker that connects the existing Core and Sentinel Workers through Cloudflare service bindings.

Deploy from this directory with `npx wrangler@latest deploy` after reviewing `wrangler.toml`.

Routes: `GET /health`, `GET /api/integrations`, `GET /api/core/health`, and `POST /api/chat`.

Core continues to enforce its own access checks. Sentinel is currently checked for reachability only. OpenClaw, OpenCode, and GPU runtimes remain separately hosted and are not installed by this Hub.

This Hub is a separate API origin. It does not replace the current user interface. The chat scroll behavior still needs a separately approved UI change.
