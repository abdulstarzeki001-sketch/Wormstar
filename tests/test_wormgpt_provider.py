import json
import unittest
from email.message import Message
from io import BytesIO

from wormgpt_provider import ENDPOINT, _NoRedirect, chat


class FakeResponse:
    def __init__(self, data, content_type="application/json"):
        self.body = BytesIO(json.dumps(data).encode("utf-8"))
        self.headers = Message()
        self.headers["Content-Type"] = content_type

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, count):
        return self.body.read(count)


class WormGPTProviderTests(unittest.TestCase):
    def setUp(self):
        self.settings = {
            "WORMGPT_API_KEY": "fake-credential-for-testing-123",
            "WORMGPT_MODEL_ID": "provider-confirmed-model-id",
        }
        self.messages = [{"role": "user", "content": "Hello"}]

    def test_requires_explicit_credentials(self):
        with self.assertRaisesRegex(ValueError, "WORMGPT_API_KEY"):
            chat(self.messages, environ={})

    def test_pinned_endpoint_and_request_body(self):
        def opener(request, timeout):
            self.assertEqual(request.full_url, ENDPOINT)
            self.assertEqual(timeout, 25)
            self.assertEqual(request.get_header("Authorization"),
                             "Bearer " + self.settings["WORMGPT_API_KEY"])
            payload = json.loads(request.data)
            self.assertEqual(payload["model"], self.settings["WORMGPT_MODEL_ID"])
            self.assertEqual(payload["messages"], self.messages)
            return FakeResponse({"choices": [{"message": {"content": "  Mock reply  "}}]})
        self.assertEqual(chat(self.messages, environ=self.settings, opener=opener), "Mock reply")

    def test_malformed_completion_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "invalid chat completion"):
            chat(self.messages, environ=self.settings,
                 opener=lambda *args, **kwargs: FakeResponse({"response": "wrong shape"}))

    def test_redirects_are_never_followed(self):
        self.assertIsNone(_NoRedirect().redirect_request(None, None, 302, 'redirect', {}, 'https://attacker.invalid'))

    def test_newline_in_api_key_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'WORMGPT_API_KEY'):
            chat(self.messages, environ={**self.settings, 'WORMGPT_API_KEY': 'x' * 20 + '\nBearer stolen'})

    def test_invalid_model_id_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "WORMGPT_MODEL_ID"):
            chat(self.messages, environ={**self.settings, "WORMGPT_MODEL_ID": "invalid id"})


if __name__ == "__main__":
    unittest.main()
