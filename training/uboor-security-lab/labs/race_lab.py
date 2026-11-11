#!/usr/bin/env python3
"""Synthetic race condition / atomic SQLite transaction demo. Offline."""
import sqlite3
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

INITIAL_KG = 2000
DEDUCTION_KG = 1500


def unsafe_demo():
    state = {"balance": INITIAL_KG}
    barrier = Barrier(2)

    def deduct(_):
        old_balance = state["balance"]
        allowed = old_balance >= DEDUCTION_KG
        barrier.wait()  # Both workers read the old state before writing
        if allowed:
            state["balance"] = old_balance - DEDUCTION_KG
        return "APPROVED" if allowed else "INSUFFICIENT"

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(deduct, range(2)))

    assert results.count("APPROVED") == 2
    assert state["balance"] == 500
    print("UNSAFE SIMULATION")
    print("Outcomes:", results)
    print("Approved quantity: 3000 kg")
    print("Recorded balance:", state["balance"], "kg")
    print()


def safe_deduct(db, request_id, quantity):
    connection = sqlite3.connect(db, timeout=10, isolation_level=None)
    try:
        connection.execute("BEGIN IMMEDIATE")
        old = connection.execute(
            "SELECT quantity, outcome FROM requests WHERE request_id=?",
            (request_id,)
        ).fetchone()

        if old:
            result = "KEY_CONFLICT" if old[0] != quantity else "REPLAY_" + old[1]
        else:
            changed = connection.execute(
                "UPDATE inventory SET balance=balance-? "
                "WHERE item_id='DEMO' AND balance>=?",
                (quantity, quantity)
            ).rowcount
            result = "APPROVED" if changed == 1 else "INSUFFICIENT"
            connection.execute(
                "INSERT INTO requests (request_id, quantity, outcome) VALUES (?, ?, ?)",
                (request_id, quantity, result)
            )
        connection.commit()
        return result
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def safe_demo():
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "inventory.db")
        con = sqlite3.connect(db)
        con.executescript("""
        CREATE TABLE inventory (
            item_id TEXT PRIMARY KEY,
            balance INTEGER NOT NULL CHECK (balance >= 0)
        );
        CREATE TABLE requests (
            request_id TEXT PRIMARY KEY,
            quantity INTEGER NOT NULL,
            outcome TEXT NOT NULL
        );
        INSERT INTO inventory VALUES ('DEMO', 2000);
        """)
        con.close()

        ids = ["REQ-A", "REQ-B"]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(
                lambda request_id: safe_deduct(db, request_id, DEDUCTION_KG),
                ids
            ))
        assert sorted(results) == ["APPROVED", "INSUFFICIENT"]

        approved_id = ids[results.index("APPROVED")]
        replay = safe_deduct(db, approved_id, DEDUCTION_KG)
        conflict = safe_deduct(db, approved_id, 100)

        con = sqlite3.connect(db)
        balance = con.execute(
            "SELECT balance FROM inventory WHERE item_id='DEMO'"
        ).fetchone()[0]
        con.close()

        assert balance == 500
        assert replay == "REPLAY_APPROVED"
        assert conflict == "KEY_CONFLICT"
        print("SAFE SQLITE SIMULATION")
        print("Outcomes:", sorted(results))
        print("Remaining balance:", balance, "kg")
        print("Same request replay:", replay)
        print("Same key, new amount:", conflict)
        print()


if __name__ == "__main__":
    unsafe_demo()
    safe_demo()
    print("ALL LOCAL CHECKS PASSED")
    print("Network requests: 0")
