import os
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["TERMINAL_ACCESS_TOKEN"] = "test_terminal_token_abcdefghijklmnopqrstuvwxyz"
os.environ["TERMINAL_CAPABILITIES"] = "health,terminal,plan,execute"
os.environ["WORMSTAR_UI_ORIGINS"] = "https://sentinel.example"

from fastapi.testclient import TestClient
import httpx
from starlette.websockets import WebSocketDisconnect
import app
import sandbox

TOKEN = "Bearer " + os.environ["TERMINAL_ACCESS_TOKEN"]


def valid_config():
    return {"State": {"Running": True}, "Config": {"User": "1000:1000",
            "Labels": {sandbox.LABEL: "v1"}}, "HostConfig": {
            "NetworkMode": "none", "Privileged": False, "ReadonlyRootfs": True,
            "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"],
            "Memory": 512 * 1024 * 1024, "NanoCpus": 1_000_000_000, "PidsLimit": 64},
            "Mounts": [{"Type": "bind", "Destination": "/workspace", "RW": True,
                        "Source": str(sandbox.WORKSPACE.resolve())}]}


class SandboxChecks(unittest.TestCase):
    def test_rejects_unsafe_or_unrelated_containers(self):
        data = valid_config()
        self.assertTrue(sandbox.valid_sandbox(data))
        for field, value in [("NetworkMode", "host"), ("Privileged", True),
                             ("ReadonlyRootfs", False), ("CapDrop", []),
                             ("Memory", 0), ("PidsLimit", 0), ("PidMode", "host"),
                             ("SecurityOpt", ["no-new-privileges", "seccomp=unconfined"]),
                             ("Devices", [{"PathOnHost": "/dev/sda"}])]:
            altered = valid_config()
            altered["HostConfig"][field] = value
            self.assertFalse(sandbox.valid_sandbox(altered), field)
        data = valid_config(); data["Mounts"].append({"Destination": "/var/run/docker.sock"})
        self.assertFalse(sandbox.valid_sandbox(data))
        data = valid_config(); data["Config"]["User"] = "0:0"
        self.assertFalse(sandbox.valid_sandbox(data))


class TerminalAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app.app)

    def tearDown(self):
        self.client.close()

    def test_auth_capability_origin_and_size(self):
        self.assertEqual(self.client.get('/api/health').status_code, 401)
        with patch.object(app, 'inspect_sandbox', return_value=False):
            ok = self.client.get('/api/health', headers={'Authorization': TOKEN, 'Origin': 'https://sentinel.example'})
        self.assertEqual(ok.status_code, 200)
        self.assertFalse(ok.json()['container_running'])
        self.assertEqual(ok.headers['access-control-allow-origin'], 'https://sentinel.example')
        self.assertEqual(self.client.get('/api/health', headers={'Authorization': TOKEN, 'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/agent/plan', headers={'Authorization': TOKEN}, content='x' * 65537).status_code, 413)
        with patch.object(app, 'CAPABILITIES', frozenset({'health'})):
            self.assertEqual(self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json={'argv':['pwd']}).status_code, 403)

    def test_execution_rejects_invalid_commands_and_unverified_sandbox(self):
        bad = {'argv':['sh','-c','id'], 'approval_id':'a' * 24, 'approved':True}
        self.assertEqual(self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json=bad).status_code, 403)
        app.PENDING['b' * 24] = (('pwd',), time.monotonic() + 60)
        with patch.object(app, 'inspect_sandbox', return_value=False):
            result = self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json={'argv':['pwd'], 'approval_id':'b' * 24, 'approved':True})
        self.assertEqual(result.status_code, 503)

    def test_plan_and_explicit_execution_with_mock_local_model(self):
        original_client = httpx.AsyncClient
        def fake_client(**kwargs):
            def reply(request):
                self.assertEqual(str(request.url), 'http://127.0.0.1:11434/api/chat')
                return httpx.Response(200, json={'message': {'content': '{"done":false,"explanation":"inspect","argv":["pwd"]}'}})
            return original_client(transport=httpx.MockTransport(reply), **kwargs)
        with patch.object(app.httpx, 'AsyncClient', side_effect=fake_client):
            result = self.client.post('/api/agent/plan', headers={'Authorization': TOKEN}, json={'goal':'show path','history':[]})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['argv'], ['pwd'])
        approval = result.json()['approval_id']
        body = {'argv':['pwd'], 'approval_id':approval, 'approved':True}
        with patch.object(app, 'run_in_container', return_value={'exit_code':0,'output':'/workspace','truncated':False}) as run:
            self.assertEqual(self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json={**body, 'approved':False}).status_code, 403)
            result = self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json=body)
            self.assertEqual(self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json=body).status_code, 403)
        self.assertEqual(result.json()['output'], '/workspace')
        run.assert_called_once_with(['pwd'])

    def test_plan_does_not_call_an_external_model_host(self):
        with patch.dict(os.environ, {'OLLAMA_URL':'https://external.example/api/chat'}):
            result = self.client.post('/api/agent/plan', headers={'Authorization': TOKEN}, json={'goal':'show path','history':[]})
        self.assertEqual(result.status_code, 503)

    def test_failed_model_does_not_expose_details_or_create_a_plan(self):
        original_client = httpx.AsyncClient
        def fake_client(**kwargs):
            def reply(request):
                return httpx.Response(503, text='private upstream error')
            return original_client(transport=httpx.MockTransport(reply), **kwargs)
        with patch.object(app.httpx, 'AsyncClient', side_effect=fake_client):
            result = self.client.post('/api/agent/plan', headers={'Authorization': TOKEN}, json={'goal':'show path','history':[]})
        self.assertEqual(result.status_code, 502)
        self.assertNotIn('private upstream error', result.text)

    def test_changed_command_and_expired_approval_are_rejected(self):
        app.PENDING['c' * 24] = (('pwd',), time.monotonic() + 60)
        body = {'argv':['ls'], 'approval_id':'c' * 24, 'approved':True}
        self.assertEqual(self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json=body).status_code, 403)
        app.PENDING['d' * 24] = (('pwd',), time.monotonic() - 1)
        body = {'argv':['pwd'], 'approval_id':'d' * 24, 'approved':True}
        self.assertEqual(self.client.post('/api/agent/execute', headers={'Authorization': TOKEN}, json=body).status_code, 403)

    def test_websocket_needs_valid_origin_and_token(self):
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect('/ws/terminal', headers={'origin':'https://sentinel.example'},
                 subprotocols=['wormstar-terminal', 'auth.invalid-token']):
                pass
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect('/ws/terminal', headers={'origin':'https://evil.example'},
                 subprotocols=['wormstar-terminal', 'auth.' + os.environ['TERMINAL_ACCESS_TOKEN']]):
                pass
        with patch.object(app, 'inspect_sandbox', return_value=False):
            with self.client.websocket_connect('/ws/terminal', headers={'origin':'https://sentinel.example'},
                 subprotocols=['wormstar-terminal', 'auth.' + os.environ['TERMINAL_ACCESS_TOKEN']]) as ws:
                self.assertIn('unavailable', ws.receive_text())

    def test_websocket_passes_input_to_a_local_mock_pty(self):
        original_popen = subprocess.Popen
        def mock_docker(_command, **kwargs):
            return original_popen(['/bin/cat'], **kwargs)
        with patch.object(app, 'inspect_sandbox', return_value=True), patch.object(app.subprocess, 'Popen', side_effect=mock_docker):
            with self.client.websocket_connect('/ws/terminal', headers={'origin':'https://sentinel.example'},
                 subprotocols=['wormstar-terminal', 'auth.' + os.environ['TERMINAL_ACCESS_TOKEN']]) as ws:
                ws.send_json({'type':'input','data':'local-pty-check\n'})
                self.assertIn('local-pty-check', ws.receive_text())


if __name__ == '__main__':
    unittest.main()
