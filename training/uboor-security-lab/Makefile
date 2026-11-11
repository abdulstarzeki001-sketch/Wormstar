SHELL := /bin/bash
.PHONY: all test labs scan clean

all:
	bash run_all.sh

test:
	python3 -m unittest discover -s tests -v

labs:
	python3 labs/validate_weight_lab.py
	python3 labs/auth_header_lab.py
	python3 labs/race_lab.py

scan:
	python3 scripts/har_forensic_lab.py samples/har_training.har --output reports/har_forensic_report.json
	python3 scripts/js_static_audit.py --directory samples/js --output reports/js_static_report.json

clean:
	rm -rf reports/*
