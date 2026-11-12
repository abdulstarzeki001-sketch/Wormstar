#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p reports

echo "== 1/9 Generate synthetic HAR =="
python3 -S scripts/create_training_har.py --output reports/har_training_generated.har

echo "== 2/9 Unit & integration tests =="
python3 -S -m unittest discover -s tests -v

echo "== 3/9 Weight lab (8 tests) =="
python3 -S labs/validate_weight_lab.py

echo "== 4/9 Authentication ordering lab =="
python3 -S labs/auth_header_lab.py

echo "== 5/9 SQLite race condition lab =="
python3 -S labs/race_lab.py

echo "== 6/9 Original HAR analyzer =="
python3 -S scripts/uboor_har_analyzer.py samples/network.har \
  --out reports/legacy_har_report.json

echo "== 7/9 HAR forensics (one sample; then 3 entries) =="
python3 -S scripts/har_forensic_lab.py samples/network.har \
  --output reports/har_one_report.json
python3 -S scripts/har_forensic_lab.py reports/har_training_generated.har \
  --output reports/har_forensic_report.json

echo "== 8/9 Response audit and JS static audit =="
python3 -S scripts/uboor_response_audit.py \
  samples/uboor_response_demo.json -o reports/response_report.json
python3 -S scripts/js_static_audit.py --directory samples/js \
  --output reports/js_static_report.json

echo "== 9/9 Correlate sanitized reports =="
python3 -S scripts/correlate_audit.py \
  --har reports/har_forensic_report.json \
  --response reports/response_report.json \
  --js reports/js_static_report.json \
  --output reports/cross_reference.json

echo "ALL LOCAL LABS COMPLETED"
