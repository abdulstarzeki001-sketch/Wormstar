"""Synthetic-only regression tests for offline QrLocalImporter review rules."""
import importlib.util
import unittest
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "tools" / "ish" / "qr_importer_review.py"
spec = importlib.util.spec_from_file_location("importer_review", FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestImporterReview(unittest.TestCase):
    def test_duplicate_early_return_is_flagged(self):
        source = 'if(t===x&&F-q<3e3){c.value={raw:t,duplicate:!0};return}'
        self.assertIn('QR-001', {x['id'] for x in mod.inspect_source(source)})

    def test_duplicate_that_reschedules_is_not_flagged(self):
        source = 'if(t===x&&F-q<3e3){c.value={duplicate:!0};requestAnimationFrame(d);return}'
        self.assertNotIn('QR-001', {x['id'] for x in mod.inspect_source(source)})

    def test_geolocation_truthy_zero_is_flagged(self):
        source = 'if(m.value.latitude&&isFinite(m.value.latitude)&&m.value.longitude){}'
        self.assertIn('QR-004', {x['id'] for x in mod.inspect_source(source)})

    def test_unrelated_source_yields_no_findings(self):
        self.assertEqual(mod.inspect_source('const x = 3;'), [])

if __name__ == "__main__":
    unittest.main()
