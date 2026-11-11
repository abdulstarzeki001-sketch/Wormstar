#!/usr/bin/env python3
"""Synthetic cargo-weight validation lab. No network requests."""
import unittest
from decimal import Decimal, InvalidOperation


def number(value):
    if isinstance(value, bool):
        raise ValueError("Boolean is not a quantity")
    if not isinstance(value, (int, float, Decimal)):
        raise ValueError("Invalid numeric type")
    try:
        result = Decimal(str(value))
    except (ValueError, InvalidOperation):
        raise ValueError("Invalid numeric value") from None
    if not result.is_finite():
        raise ValueError("Non-finite quantity")
    return result


def validate(payload):
    errors = []
    total = Decimal("0")
    seen_ids = set()
    items = [
        (key, value)
        for key, value in payload.items()
        if key.startswith("item") and key[4:].isdigit()
    ]
    if not items:
        errors.append("No items")

    for key, item in items:
        if not isinstance(item, dict):
            errors.append(f"{key}: invalid object")
            continue
        item_id = item.get("hash_id")
        if not item_id:
            errors.append(f"{key}: missing identifier")
        elif item_id in seen_ids:
            errors.append(f"{key}: duplicate identifier")
        else:
            seen_ids.add(item_id)
        try:
            qty = number(item.get("production_capacity"))
            if qty <= 0:
                errors.append(f"{key}: quantity not positive")
            total += qty
        except (ValueError, TypeError, ArithmeticError):
            errors.append(f"{key}: invalid quantity")

    vehicle = payload.get("vihcle_info")  # Existing client spelling
    if not isinstance(vehicle, dict):
        errors.append("Missing vehicle info")
        return errors
    try:
        weight = number(vehicle.get("weight_quantity"))
        if weight <= 0:
            errors.append("Weight not positive")
        if total != weight:
            errors.append("Weight mismatch")
    except (ValueError, TypeError, ArithmeticError):
        errors.append("Invalid weight")
    return errors


def make_payload(qty=1.9, weight=1.9):
    return {
        "item1": {"hash_id": "FAKE-ITEM-A", "production_capacity": qty},
        "vihcle_info": {"weight_quantity": weight}
    }


class WeightSecurityTests(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(validate(make_payload()), [])

    def test_mismatch(self):
        self.assertTrue(validate(make_payload(1.9, 2.5)))

    def test_negative(self):
        self.assertTrue(validate(make_payload(-1.9, -1.9)))

    def test_zero(self):
        self.assertTrue(validate(make_payload(0, 0)))

    def test_boolean(self):
        self.assertTrue(validate(make_payload(True, 1)))

    def test_duplicate_item(self):
        p = make_payload()
        p["item2"] = {"hash_id": "FAKE-ITEM-A", "production_capacity": 0.5}
        p["vihcle_info"]["weight_quantity"] = 2.4
        self.assertTrue(validate(p))

    def test_decimal_precision(self):
        p = make_payload(0.1, 0.3)
        p["item2"] = {"hash_id": "FAKE-ITEM-B", "production_capacity": 0.2}
        self.assertEqual(validate(p), [])

    def test_missing_vehicle(self):
        p = make_payload()
        del p["vihcle_info"]
        self.assertTrue(validate(p))


if __name__ == "__main__":
    unittest.main(verbosity=2)
