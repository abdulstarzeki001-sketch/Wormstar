# GitHub / Cloudflare deployment

Repository: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH

`site/worker.js` is the standalone Cloudflare Worker code used for the public dashboard.
It does not proxy or call the governmental site. The site's JSON importer runs locally
in your browser, without uploading documents to the server.

The Python audit source lives in `analyze.py`, usable offline in iSH/a-Shell/Linux.
Do not upload raw government JavaScript archives, cookies, user tokens, or personal data.

Cloudflare deployment through an authenticated API connection is independent of GitHub.
For automated deployments on each push, explicitly connect the repository to Cloudflare
Builds in the Cloudflare dashboard or configure a CI workflow with a secret API token.
Do not commit API tokens.
