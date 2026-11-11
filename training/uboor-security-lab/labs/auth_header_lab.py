#!/usr/bin/env python3
"""Purely local Authorization-header ordering exercise (fake tokens)."""


def simulate_request(owner_token=None, global_token=None):
    headers = {}
    if owner_token:
        headers["Authorization"] = f"Bearer {owner_token}"
    if global_token:
        headers["Authorization"] = f"Bearer {global_token}"
    return headers.get("Authorization", "ABSENT")


def main():
    cases = [
        ("Owner only", "OWNER_FAKE", None),
        ("Global only", None, "GLOBAL_FAKE"),
        ("Both sessions", "OWNER_FAKE", "GLOBAL_FAKE"),
        ("No session", None, None),
    ]
    print("=== AUTHORIZATION HEADER SIMULATION ===")
    for label, owner, global_user in cases:
        print(f"{label:15} => {simulate_request(owner, global_user)}")
    assert simulate_request("OWNER_FAKE", "GLOBAL_FAKE") == "Bearer GLOBAL_FAKE"
    print("\nNo network requests were made.")


if __name__ == "__main__":
    main()
