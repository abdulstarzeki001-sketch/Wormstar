"""Synthetic, read-only tests: do not contact any government server."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "tools" / "ish" / "use_health_certificate_review.py"
spec = importlib.util.spec_from_file_location("health_comp_review", MODULE)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class TestUseHealthCertificateReview(unittest.TestCase):
    def ids(self, text):
        return {r["id"] for r in audit.inspect(text)}

    def test_thirteen_unique_rules(self):
        ids=[r[0] for r in audit.RULES]
        self.assertEqual(13,len(ids))
        self.assertEqual(len(ids),len(set(ids)))

    def test_twelve_unique_api_paths(self):
        self.assertEqual(12,len(audit.API))
        self.assertEqual(12,len(set(r[1] for r in audit.API)))

    def test_detect_singleton(self):
        self.assertIn("HC-01",self.ids("let T=null;function Oe(){if(T)return T;"))

    def test_both_logs_required(self):
        a='console.log("[useHealthCertificate] request body sent to API:",JSON.stringify(n))'
        b='console.debug("[HealthCertificate] raw response:",t)'
        self.assertNotIn("HC-02",self.ids(a))
        self.assertIn("HC-02",self.ids(a+b))

    def test_error_response_continues(self):
        s="t.error||t.success===!1?(p(i),P.value=i):H(i);w.value=Array.isArray(c)?c:[]"
        self.assertIn("HC-03",self.ids(s))

    def test_inflight_cache(self):
        self.assertIn("HC-05",self.ids("if(M.has(Number(e)))return v.value.filter(t=>true)"))

    def test_fixed_province_fallback(self):
        self.assertIn("HC-06",self.ids("for(let i=1;i<=18;i++){}"))

    def test_doc_number_coercion(self):
        self.assertIn("HC-10",self.ids('if(h==="doc_number"){const G=Number(k)'))
        self.assertNotIn("HC-10",self.ids('if(h==="doc_number"){const G=String(k)'))

    def test_preview_storage_requires_two_signals(self):
        a='sessionStorage.setItem("qr_preview_entry",JSON.stringify(t))'
        self.assertNotIn("HC-09",self.ids(a))
        self.assertIn("HC-09",self.ids(a+"raw:{doc_number:e,response:a}"))

    def test_parallel_lookup(self):
        s="await Promise.all(n.map(a=>B(a)));await Promise.all(r.map(a=>U(a)))"
        self.assertIn("HC-12",self.ids(s))

    def test_api_inventory(self):
        src='g.post("BorderPort_HS/health-certificates",e);g.get("BorderPort_HS/return_doc_hc/" + value)'
        self.assertEqual([v["path"] for v in audit.api_inventory(src)],[
            "BorderPort_HS/health-certificates",
            "BorderPort_HS/return_doc_hc/{hash}",
        ])

    def test_reject_waf_html(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"health.js"
            path.write_text("<html>HuaweiCloudWAF</html>",encoding="utf-8")
            with self.assertRaises(ValueError):
                audit.checked_read(path)

    def test_unrelated_source(self):
        self.assertEqual([],audit.inspect("const x=1;"))

if __name__=="__main__":
    unittest.main()
