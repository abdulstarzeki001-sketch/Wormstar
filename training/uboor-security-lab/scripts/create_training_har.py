#!/usr/bin/env python3
"""Generate a fully synthetic HAR for reproducible duplicate/mismatch tests."""
import argparse
import json
from copy import deepcopy
from pathlib import Path


def make_har():
    url = "https://example.invalid/api/local_form/company_item_reduce"
    payload = {
        "item1": {"hash_id": "FAKE-ITEM-A", "production_capacity": 1.9},
        "vihcle_info": {"weight_quantity": "1.9"},
    }
    different = deepcopy(payload)
    different["vihcle_info"]["weight_quantity"] = "2.5"

    def make_entry(body):
        return {
            "request": {
                "method": "PUT",
                "url": url,
                "postData": {
                    "mimeType": "application/json",
                    "text": json.dumps(body, ensure_ascii=False),
                },
            },
            "response": {"status": 200},
        }
    return {
        "log": {
            "version": "1.2",
            "creator": {"name": "Offline Training", "version": "1.0"},
            "entries": [
                make_entry(payload), make_entry(deepcopy(payload)),
                make_entry(different),
            ],
        }
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="samples/har_training.har")
    args = parser.parse_args()
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(make_har(), ensure_ascii=False, indent=2) + "\n")
    print("Created synthetic HAR with 3 entries:", path)


if __name__ == "__main__":
    main()
