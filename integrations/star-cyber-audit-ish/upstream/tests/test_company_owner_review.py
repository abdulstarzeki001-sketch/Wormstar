"""Offline synthetic regression tests for CompanyOwnerView/QRLocal reviewer."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "tools" / "ish" / "company_owner_review.py"
spec = importlib.util.spec_from_file_location("company_owner_review", PATH)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

ROOT = '__name:"CompanyOwnerView"'

class TestCompanyOwnerReview(unittest.TestCase):
    def view_ids(self, fragment):
        return {x["id"] for x in audit.match(fragment, audit.VIEW_RULES)}

    def store_ids(self, fragment):
        return {x["id"] for x in audit.match(fragment, audit.MAIN_RULES)}

    def qr_ids(self, fragment):
        return {x["id"] for x in audit.match(fragment, audit.QR_RULES)}

    def test_unique_rule_counts(self):
        for rules, count in [(audit.VIEW_RULES, 22), (audit.MAIN_RULES, 8), (audit.QR_RULES, 10)]:
            ids = [r[0] for r in rules]
            self.assertEqual(len(ids), count)
            self.assertEqual(len(set(ids)), count)

    def test_detect_four_components(self):
        self.assertIn("CO-01", self.view_ids('__name:"CompanyOwnerItems";__name:"VSearchHashCode";__name:"AppUrLogin";__name:"CompanyOwnerView"'))

    def test_url_phone_and_code(self):
        self.assertIn("CO-02", self.view_ids("_.query.phone;_.query.code"))

    def test_auth_race_indicator(self):
        s = 'u.checkUserAuthentication().finally(()=>{});if(!u.isAuthenticatedOwner){}'
        self.assertIn("CO-03", self.view_ids(s))
        self.assertNotIn("CO-03", self.view_ids('await u.checkUserAuthentication();if(!u.isAuthenticatedOwner){}'))

    def test_redirect_even_when_verification_fails(self):
        s = 'companyVerifyLoginWithCode(n.value).finally(()=>m.replace({query:{phone:d.value.UsPhoneNo}}))'
        self.assertIn("CO-04", self.view_ids(s))

    def test_phone_written_to_url(self):
        self.assertIn("CO-05", self.view_ids('m.replace({query:{phone:d.value.UsPhoneNo}})'))

    def test_ur_client_id_and_phone(self):
        self.assertIn("CO-06", self.view_ids("https://ur.gov.iq/verify-auth?client_id=261;pNo="))

    def test_raw_redirect_interpolation_pattern(self):
        self.assertIn("CO-07", self.view_ids("window.location.href=serviceName=foo&pNo=bar"))

    def test_company_hash_console(self):
        self.assertIn("CO-08", self.view_ids('console.debug("hash to regenerate:",c)'))

    def test_company_lookup(self):
        self.assertIn("CO-09", self.view_ids('u.searchCompanyOwner(m.value.trim())'))

    def test_regenerate_doc_from_hash(self):
        self.assertIn("CO-10", self.view_ids('n.value?.company_hash_code||m.value.trim();u.returnCompanyDoc(c)'))

    def test_zero_location_gating(self):
        self.assertIn("CO-11", self.view_ids("s.latitude&&s.longitude&&isFinite(s.latitude)&&isFinite(s.longitude)"))
        self.assertNotIn("CO-11", self.view_ids("s.latitude!=null&&s.longitude!=null"))

    def test_sensitive_coordinate_logging(self):
        self.assertIn("CO-12", self.view_ids('console.log("Geolocation Updated - X:",o.x_coordinate)'))

    def test_typo_payload_is_detected(self):
        self.assertIn("CO-13", self.view_ids("vihcle_info:{...o}"))
        self.assertNotIn("CO-13", self.view_ids("vehicle_info:{...o}"))

    def test_quantity_cap_is_ui_only(self):
        self.assertIn("CO-14", self.view_ids("if(t>s.production_capacity){}"))

    def test_quantity_cast(self):
        self.assertIn("CO-15", self.view_ids("Number(P.target.value)"))

    def test_numbered_items_payload(self):
        self.assertIn("CO-16", self.view_ids("item1;hash_id:T.hash_id,production_capacity:T.production_capacity"))

    def test_required_fields(self):
        self.assertIn("CO-17", self.view_ids("!o.driver_name||!o.licence_number||!o.vehicle_number||!o.weight_quantity"))

    def test_checkpoint_condition(self):
        self.assertIn("CO-18", self.view_ids('n.value==="داخل الإقليم";n.value==="محاذية الإقليم";n.value==="خارج الإقليم و بنسبة 5%"'))

    def test_mutating_action(self):
        self.assertIn("CO-19", self.view_ids('await _.companyItemsReduce(h)'))

    def test_temporary_document_preview(self):
        self.assertIn("CO-20", self.view_ids('title:"الوثيقة المؤقتة";doc:B.value'))

    def test_contact_display(self):
        self.assertIn("CO-21", self.view_ids("company_phone_number;UsPhoneNo"))

    def test_locally_calculated_quantity(self):
        self.assertIn("CO-22", self.view_ids("o.weight_quantity=q.value"))

    def test_main_api_paths(self):
        source = 'tt.post("local_form/company_verify_login";tt.post("local_form/company_verification";tt.post("local_form/search_iraqi_company";local_form/get_company_items/;tt.put("local_form/company_item_reduce";local_form/return_company_doc/;tt.post(n,null'
        self.assertTrue({f"CM-{x:02d}" for x in range(1,7)}.issubset(self.store_ids(source)))

    def test_local_storage_session_indicators(self):
        source = 'localStorage.getItem("company_owner_token");localStorage.getItem("is_authenticated_owner");localStorage.setItem("company_owner_token",this.companyOwnerToken)'
        self.assertTrue({"CM-07","CM-08"}.issubset(self.store_ids(source)))

    def test_local_qr_geo_and_post(self):
        source = '__name:"QRLocal";navigator.geolocation.getCurrentPosition(;w.value.latitude;E.post("local_form/read_doc_company",$'
        self.assertTrue({"CL-01","CL-03"}.issubset(self.qr_ids(source)))

    def test_local_qr_sensitive_logs(self):
        self.assertIn("CL-04", self.qr_ids('console.debug("[QRLocal] auth token:",y.token)'))

    def test_qr_post_debug_fallback(self):
        self.assertIn("CL-05", self.qr_ids('fetch(h,{method:"POST";debug fetch status'))

    def test_local_qr_expiry_heuristic(self):
        self.assertIn("CL-06", self.qr_ids("2880*60*1e3"))
        self.assertIn("CL-07", self.qr_ids("/تم|نجح|نجاح|تم ارسال|تمت/iu.test(a.message)"))

    def test_qr_is_main_and_autosend(self):
        self.assertIn("CL-08", self.qr_ids("a.is_main=l.data.is_main"))
        self.assertIn("CL-09", self.qr_ids("auto_send:!!a.is_main"))

    def test_full_source_cross_links(self):
        view = ROOT + ';await _.companyItemsReduce(h)'
        scanner = '__name:"QRLocal";auto_send:!!a.is_main'
        main = 'companyItemsReduce(t)'
        findings = audit.inspect(view, main, scanner)
        self.assertTrue(all(findings["links"].values()))

    def test_reject_wrong_input_bundle(self):
        with self.assertRaises(ValueError):
            audit.inspect('const random=1')

    def test_reject_wrong_optional_source(self):
        with self.assertRaises(ValueError):
            audit.inspect(ROOT, main='wrong')
        with self.assertRaises(ValueError):
            audit.inspect(ROOT, scanner='wrong')

    def test_reject_html_binary(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "wrong.js"
            file.write_text("<!doctype html><html>WAF</html>")
            with self.assertRaises(ValueError):
                audit.read_source(file)

    def test_clean_compliant_marker(self):
        self.assertEqual({"company": []}, audit.inspect(ROOT))

if __name__ == "__main__":
    unittest.main()
