import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("star_osint_cloud_agent", ROOT / "scripts" / "cloud_agent.py")
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)


class CloudAgentValidationTests(unittest.TestCase):
    def test_core_origin_pinned(self):
        self.assertEqual(agent.core_origin(agent.DEFAULT_CORE),agent.DEFAULT_CORE)
        for target in [
            "http://wormstar-ai-lab.abdulstarzeki001.workers.dev",
            "https://other.workers.dev",
            "https://wormstar-ai-lab.abdulstarzeki001.workers.dev.evil.org",
            "https://wormstar-ai-lab.abdulstarzeki001.workers.dev/path",
            "https://wormstar-ai-lab.abdulstarzeki001.workers.dev?token=abc",
            "https://alice:password@wormstar-ai-lab.abdulstarzeki001.workers.dev",
        ]:
            with self.subTest(target=target):
                with self.assertRaises(ValueError):
                    agent.core_origin(target)

    def test_domain_requires_local_allowlist(self):
        self.assertTrue(agent.domain_permitted("owned-site.org","owned-site.org"))
        self.assertTrue(agent.domain_permitted("sub.owned-site.org","*.owned-site.org"))
        for domain in [
            "other-site.org","owned-site.org.attacker.org","localhost",
            "http://owned-site.org/path","127.0.0.1","sub.owned-site.org"
        ]:
            self.assertFalse(agent.domain_permitted(domain,"owned-site.org"),domain)

    def test_invalid_jobs_do_not_execute_collectors(self):
        blocked = agent.run_local({"domain":"not-owned.org","collectors":["dns"]},"owned-site.org")
        self.assertEqual(blocked["status"],"failed")
        blocked = agent.run_local({"domain":"owned-site.org","collectors":["shell"]},"owned-site.org")
        self.assertEqual(blocked["status"],"failed")
        blocked = agent.run_local({"domain":"owned-site.org","collectors":["dns","dns"]},"owned-site.org")
        self.assertEqual(blocked["status"],"failed")


if __name__=="__main__":
    unittest.main()
