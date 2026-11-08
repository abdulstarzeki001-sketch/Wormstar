"""Synthetic-only checks: do not execute a third-party JS file or call APIs."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / 'tools' / 'ish' / 'qr_document_review.py'
spec = importlib.util.spec_from_file_location('qr_document_review', TOOL)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class TestQrDocumentReview(unittest.TestCase):
    def ids(self, text):
        return {result['id'] for result in audit.inspect(text)}

    def test_unique_rules(self):
        rule_ids = [rule[0] for rule in audit.RULES]
        self.assertEqual(20, len(rule_ids))
        self.assertEqual(len(set(rule_ids)), len(rule_ids))

    def test_route_state_and_store(self):
        source = 'history.state?.preview||null;const x=CB(),P=b.query.id;x.find(oA=>String(oA.id)===P)'
        self.assertIn('QD-01', self.ids(source))

    def test_unknown_id_fallback(self):
        self.assertIn('QD-02', self.ids('a.value=AA||x[0]||null'))
        self.assertNotIn('QD-02', self.ids('a.value=AA||null'))

    def test_session_preview_conditional_read(self):
        self.assertIn('QD-03', self.ids('if(!AA&&oA){sessionStorage.getItem("qr_preview_entry")}'))

    def test_response_unwrapping(self):
        self.assertIn('QD-04', self.ids('AA?.response?.data?AA.response=AA.response.data:AA?.data?AA.response=AA.data'))

    def test_qr_code_rendering(self):
        self.assertIn('QD-05', self.ids('UB.toDataURL(E,{width:400,margin:1});a.value?.response?.qr_code'))

    def test_refusal_post(self):
        self.assertIn('QD-06', self.ids('cf.post("local_form/refuse_doc_company",x)'))

    def test_refusal_requires_visible_privilege(self):
        self.assertIn('QD-07', self.ids('Y.value&&i.value.includes("refuse_doc_company")'))

    def test_handler_checks_main_not_privilege(self):
        self.assertIn('QD-08', self.ids('async function G(){if(!Y.value){}cf.post("local_form/refuse_doc_company",x)'))

    def test_refusal_http_success_toast(self):
        s = 'await cf.post("local_form/refuse_doc_company",x);pB("تم إرسال طلب الرفض بنجاح")'
        self.assertIn('QD-09', self.ids(s))

    def test_coords_from_read_log(self):
        self.assertIn('QD-10', self.ids('E[E.length-1]:null;x_coordinate:c.value||"0",y_coordinate:h.value||"0"'))

    def test_reason_length(self):
        self.assertIn('QD-11', self.ids('if(e.value.trim().length<2){}'))

    def test_checkpoint_session(self):
        self.assertIn('QD-12', self.ids('sessionStorage.setItem("qr_read_doc",JSON.stringify(_.value||[]))'))

    def test_autosend_upload(self):
        s = 'if(a.value&&a.value.auto_send){cf.post("BorderPort_HS/path-document-file",E,X);P.append("file",x,"local_document.png")}'
        self.assertIn('QD-13', self.ids(s))
        self.assertNotIn('QD-13', self.ids('P.append("file",x,"local_document.png")'))

    def test_capture_delay(self):
        self.assertIn('QD-14', self.ids('setTimeout(async()=>{capture()},100)'))

    def test_autosend_reset_after_success(self):
        s = 'await L(P),console.log("Upload successful.");delete AA[oA].auto_send;delete a.value.auto_send'
        self.assertIn('QD-15', self.ids(s))

    def test_qr_failure_returns_empty(self):
        self.assertIn('QD-16', self.ids('UB.toDataURL(E,{width:400,margin:1});catch{return""}'))

    def test_browser_print(self):
        self.assertIn('QD-17', self.ids('window.print();P.document.write("hello");P.onload=()=>{P.focus(),P.print()}'))

    def test_official_branding_only_visual(self):
        self.assertIn('QD-18', self.ids('"جمهورية العراق" "وزارة المالية" "الهيئــة العامــة للكمـــارك"'))

    def test_document_number_display(self):
        self.assertIn('QD-19', self.ids('a.value.response.doc_id'))

    def test_modal_reason_confirmation(self):
        self.assertIn('QD-20', self.ids('__name:"RefuseDocModal" "تأكيد الرفض" "سبب الرفض"'))

    def test_auto_flags_not_consumed(self):
        s = '__name:"QRDocument"; function H(){window.print()}'
        self.assertIn('QD-21', self.ids(s))
        self.assertNotIn('QD-21', self.ids(s + ';const autoPrint = true'))

    def test_not_confusing_other_components(self):
        self.assertNotIn('QD-21', self.ids('window.print()'))

    def test_reject_html_or_waf(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'QRDocument.js'
            p.write_text('<!doctype html><html>WAF</html>')
            with self.assertRaises(ValueError):
                audit.checked_read(p)

    def test_unrelated_source_no_results(self):
        self.assertEqual([], audit.inspect('const nope = false'))

if __name__ == '__main__':
    unittest.main()
