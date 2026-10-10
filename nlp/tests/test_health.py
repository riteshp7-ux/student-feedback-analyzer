import unittest
from fastapi.testclient import TestClient
from nlp.src.service import app

class TestServiceHealth(unittest.TestCase):
    def setUp(self):
        # Using context manager to trigger lifespan events (model loading)
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["version"], "1.0.0")
        self.assertEqual(data["model_status"], "ready")
        self.assertEqual(data["sentiment_model_version"], "v1.0.0")
        self.assertEqual(data["topic_model_version"], "v1.0.0")
        self.assertEqual(data["dataset_version"], "v1.0.0")
        self.assertIn("timestamp", data)

    def test_versioned_health_endpoint(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["model_status"], "ready")

    def test_readiness_endpoint(self):
        response = self.client.get("/ready")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertTrue(data["ready"])
        self.assertEqual(data["model_version"], "v1.0.0")
        self.assertIn("timestamp", data)

    def test_unknown_route_returns_404(self):
        response = self.client.get("/non-existent-endpoint")
        self.assertEqual(response.status_code, 404)

if __name__ == "__main__":
    unittest.main()
