import unittest
from fastapi.testclient import TestClient
from nlp.src.service import app
from nlp.src.inference import engine
from nlp.src.preprocessing import APPROVED_SENTIMENTS, APPROVED_TOPICS

class TestInferenceService(unittest.TestCase):
    def setUp(self):
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    # -------------------------------------------------------------------------
    # Happy Path Inference Tests
    # -------------------------------------------------------------------------

    def test_analyze_positive_feedback(self):
        payload = {"text": "The professor explains concepts clearly and with great depth."}
        response = self.client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["sentiment"]["label"], "positive")
        self.assertTrue(0.0 <= data["sentiment"]["confidence"] <= 1.0)
        self.assertIn("teaching_clarity", [t["label"] for t in data["topics"]])
        self.assertEqual(data["modelVersion"], "v1.0.0")

    def test_analyze_negative_feedback_on_pacing(self):
        payload = {"text": "Too fast and rushed through slides without explaining properly."}
        response = self.client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["sentiment"]["label"], "negative")
        self.assertTrue(0.0 <= data["sentiment"]["confidence"] <= 1.0)
        self.assertIn("teaching_pace", [t["label"] for t in data["topics"]])

    def test_analyze_multi_topic_feedback(self):
        payload = {"text": "Great live coding examples and demonstrations, but the pacing was frantic and rushed."}
        response = self.client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        topic_labels = [t["label"] for t in data["topics"]]
        self.assertIn("practical_examples", topic_labels)
        self.assertIn("teaching_pace", topic_labels)

    def test_analyze_zero_topic_general_feedback(self):
        payload = {"text": "Overall satisfactory, standard lecture course."}
        response = self.client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIsInstance(data["topics"], list)
        # Verify topics can be empty or general without error
        for t in data["topics"]:
            self.assertIn(t["label"], APPROVED_TOPICS)

    def test_versioned_endpoint_parity(self):
        payload = {"text": "Great live coding and clear explanations."}
        res_standard = self.client.post("/analyze", json=payload)
        res_versioned = self.client.post("/api/v1/analyze", json=payload)

        self.assertEqual(res_standard.status_code, 200)
        self.assertEqual(res_versioned.status_code, 200)
        self.assertEqual(res_standard.json(), res_versioned.json())

    # -------------------------------------------------------------------------
    # Output Contract Verification
    # -------------------------------------------------------------------------

    def test_output_contract_exact_fields(self):
        payload = {"text": "Assignments are practical and feedback was prompt."}
        response = self.client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        # Verify strict keys in response
        self.assertEqual(set(data.keys()), {"sentiment", "topics", "modelVersion"})

        # Sentiment contract
        sentiment = data["sentiment"]
        self.assertIn(sentiment["label"], APPROVED_SENTIMENTS)
        self.assertIsInstance(sentiment["confidence"], float)
        self.assertTrue(0.0 <= sentiment["confidence"] <= 1.0)
        self.assertIn("probabilities", sentiment)
        prob_sum = sum(sentiment["probabilities"].values())
        self.assertAlmostEqual(prob_sum, 1.0, places=2)

        # Topics contract
        for topic in data["topics"]:
            self.assertEqual(set(topic.keys()), {"label", "confidence"})
            self.assertIn(topic["label"], APPROVED_TOPICS)
            self.assertTrue(0.0 <= topic["confidence"] <= 1.0)

    # -------------------------------------------------------------------------
    # Input Validation Tests (422)
    # -------------------------------------------------------------------------

    def test_validation_missing_text_field(self):
        response = self.client.post("/analyze", json={})
        self.assertEqual(response.status_code, 422)
        data = response.json()
        self.assertEqual(data["error"], "UNPROCESSABLE_ENTITY")

    def test_validation_empty_string(self):
        response = self.client.post("/analyze", json={"text": ""})
        self.assertEqual(response.status_code, 422)

    def test_validation_whitespace_only_string(self):
        response = self.client.post("/analyze", json={"text": "     \n\t  "})
        self.assertEqual(response.status_code, 422)

    def test_validation_non_string_type(self):
        response = self.client.post("/analyze", json={"text": 12345})
        self.assertEqual(response.status_code, 422)

    def test_validation_rejects_unexpected_fields(self):
        # Privacy & contract boundary: extra identity or metadata fields must be rejected
        payload = {
            "text": "Great teaching pace.",
            "student_id": "std-12345",
            "course_id": "cs-101"
        }
        response = self.client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_validation_oversized_payload(self):
        oversized = "a" * 5001
        response = self.client.post("/analyze", json={"text": oversized})
        self.assertEqual(response.status_code, 422)

    # -------------------------------------------------------------------------
    # Idempotency and Determinism
    # -------------------------------------------------------------------------

    def test_repeated_inference_determinism(self):
        payload = {"text": "Hands-on coding demonstrations were very helpful."}
        res1 = self.client.post("/analyze", json=payload).json()
        res2 = self.client.post("/analyze", json=payload).json()
        res3 = self.client.post("/analyze", json=payload).json()

        self.assertEqual(res1, res2)
        self.assertEqual(res2, res3)

    # -------------------------------------------------------------------------
    # Service Failure Semantics (503 when model unavailable)
    # -------------------------------------------------------------------------

    def test_service_unavailable_when_engine_unready(self):
        # Temporarily simulate unready state
        original_state = engine._is_ready
        try:
            engine._is_ready = False

            # /ready returns 503
            res_ready = self.client.get("/ready")
            self.assertEqual(res_ready.status_code, 503)
            self.assertFalse(res_ready.json()["ready"])

            # /analyze returns 503
            res_analyze = self.client.post("/analyze", json={"text": "Any text"})
            self.assertEqual(res_analyze.status_code, 503)
            self.assertIn("temporarily unavailable", res_analyze.json()["detail"])

            # /health reflects degraded
            res_health = self.client.get("/health")
            self.assertEqual(res_health.status_code, 200)
            self.assertEqual(res_health.json()["status"], "degraded")
            self.assertEqual(res_health.json()["model_status"], "unavailable")
        finally:
            engine._is_ready = original_state

if __name__ == "__main__":
    unittest.main()
