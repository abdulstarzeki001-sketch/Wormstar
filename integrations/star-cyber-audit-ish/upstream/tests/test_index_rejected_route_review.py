"""Synthetic-only tests for the main-bundle rejected-document checker."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "tools" / "ish" / "index_rejected_route_review.py"
spec = importlib.util.spec_from_file_location("index_rejected_route_review", MODULE)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

OWNER = (
    'async fetchRejectedLocalReaders(t={}){const e=t.page??1,n=t.per_page??10,'
    's={page:e,per_page:n,sort_by:"id",sort_dir:"desc"};'
    'if(t.searchdata&&Array.isArray(t.searchdata))s.searchdata=t.searchdata;'
    'for(const o of t.searchFields){};s.start_date=t.start_date;s.end_date=t.end_date;'
    'const i=(await tt.post("local_form/pagination_rejected_qrcode_reader",s)).data||{};'
    'i.error||i.success===!1?ze(o):At(o);return r.hide(),i},logoutOwner(){}'
)
ROUTES = (
    'path:"/dashboard",meta:{requiresAuth:!0},children:['
    '{path:"qr/local-rejected",name:"RejectedLocalDocuments"},'
    '{path:"health-certificates/print",name:"HealthCertificatePrint",'
    'component:()=>import("./PrintHealthCertificateView-Q9yNncqz.js")}]},Qr=AB({'
    'Qr.beforeEach(async(t,e,n)=>{return t.meta?.requiresAuth&&!r?n({name:"Home"}):n()});'
    'const nu=qm('
)
AXIOS = (
    'tt=pn.create({baseURL:"https://customs-uboor.ur.gov.iq/api/",headers:{}});'
    'tt.interceptors.request.use(t=>{const n=nu().token;n&&(t.headers.Authorization=`Bearer ${n}`)});'
    's===403&&ze("not allowed");const bq=qm('
)
AUTH = (
    'async logout(){this.token=null;localStorage.removeItem("auth");Qr.push({name:"Home"})},'
    'loadAuth(){const t=localStorage.getItem("auth");JSON.parse(t)}}}),Nq='
)

class TestIndexRejectedRouteReview(unittest.TestCase):
    def ids(self, source):
        return {m["id"] for m in audit.analyze(source)["matches"]}

    def test_endpoint_identified(self):
        self.assertIn("IR-01", self.ids(OWNER))

    def test_api_url_requires_base_url(self):
        self.assertEqual([], audit.analyze(OWNER)["api"])
        actual = audit.analyze(OWNER + AXIOS)["api"][0]["path"]
        self.assertEqual("/api/local_form/pagination_rejected_qrcode_reader", actual)

    def test_request_body_pagination_sort(self):
        self.assertIn("IR-02", self.ids(OWNER))

    def test_search_filters(self):
        self.assertIn("IR-03", self.ids(OWNER))
        self.assertIn("IR-04", self.ids(OWNER))

    def test_error_response_still_returned(self):
        self.assertIn("IR-05", self.ids(OWNER))
        self.assertNotIn("IR-05", self.ids(OWNER.replace("r.hide(),i", "r.hide(),null")))

    def test_parent_route_requires_authentication(self):
        self.assertIn("IR-06", self.ids(ROUTES))
        self.assertIn("IR-07", self.ids(ROUTES))
        self.assertEqual("/dashboard/qr/local-rejected", audit.analyze(ROUTES)["route"])

    def test_guard_only_checks_auth(self):
        self.assertIn("IR-08", self.ids(ROUTES))
        self.assertIn("IR-09", self.ids(ROUTES))
        guarded = ROUTES.replace("t.meta?.requiresAuth&&!r", "t.meta?.requiresAuth&&!r||s.user_privileges.length===0")
        self.assertNotIn("IR-09", self.ids(guarded))

    def test_http_interceptor(self):
        self.assertTrue({"IR-10", "IR-11", "IR-12"}.issubset(self.ids(AXIOS)))

    def test_logout_preserves_default_header(self):
        self.assertIn("IR-13", self.ids(AUTH))
        fixed = AUTH.replace('localStorage.removeItem("auth")',
                             'delete tt.defaults.headers.common.Authorization;localStorage.removeItem("auth")')
        self.assertNotIn("IR-13", self.ids(fixed))

    def test_json_parse_without_guard(self):
        self.assertIn("IR-14", self.ids(AUTH))

    def test_health_print_asset_link(self):
        self.assertIn("IR-15", self.ids(ROUTES))

    def test_html_page_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "fake.js"
            path.write_text("<!doctype html><html>WAF</html>")
            with self.assertRaises(ValueError):
                audit.checked_read(path)

    def test_empty_source_has_no_indicators(self):
        self.assertEqual([], audit.analyze("const x=1")["matches"])

    def test_scope_of_routed_guard_not_server_claim(self):
        self.assertIn("server permission checks not tested", audit.analyze(ROUTES)["limits"])

if __name__ == "__main__":
    unittest.main()
