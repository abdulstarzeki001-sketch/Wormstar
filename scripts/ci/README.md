# Wormstar quality gate

CI validates these code paths **before** running either Cloudflare deployment:
- Core policy, model routing, auth, RAG, agents and security tests.
- Sentinel UI bundle and same-origin audit routes.
- iSH Python static analyzer and local read-only source inventory.
- UBOOR synthetic offline lab and its regression tests.
- Private terminal authentication, sandbox configuration and protocol tests using mocks.

`security-gate.mjs` examines **newly added lines** between the event's base SHA
and the tested Git commit and emits a SHA-bound JSON artifact. New high/medium
patterns block deployment; existing legacy findings are not silently rewritten.
The report distinguishes all added lines from lines actually scanned. UBOOR and
the terminal are included; samples, fixtures and tests remain excluded.
Run this gate in pull requests and both deployment workflows.

The iSH static analyzer has a different schema (`files[].flags`):
review flags are **not** the same as verified security vulnerabilities.
`validate-ish-report.mjs` validates the schema and records totals, but does
not invent a HIGH/MEDIUM threshold.

The scripts are dependency-free and do not call remote scanners.
Quality and security gates never receive Cloudflare credentials.
Only deployment jobs access the secret-scoped Cloudflare token.
Do not disable tests or expand scan scope to make a red build turn green.

To test locally:

```sh
node --test scripts/ci/test-security-gate.mjs
npm --prefix cloudflare-worker test
npm --prefix wormstar-ui test
python3 -m unittest discover -s integrations/star-cyber-audit-ish/tests -p 'test_*.py'
bash scripts/run-uboor-lab.sh
python3 -m unittest discover -s integrations/wormstar-linux-terminal/tests -p 'test_*.py'
python3 integrations/star-cyber-audit-ish/analyze.py --local wormstar-ui
node scripts/ci/validate-ish-report.mjs integrations/star-cyber-audit-ish/reports/analysis.json
```

No live third-party targets are tested in CI. For production deployment to Cloudflare,
the protected workflow runs quality validation before accessing secrets.
