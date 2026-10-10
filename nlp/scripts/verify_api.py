import json
import time
from fastapi.testclient import TestClient
from nlp.src.service import app

def run_manual_api_verification():
    print("=" * 70)
    print("STAGE 15 MANUAL API VERIFICATION RUN")
    print("=" * 70)

    with TestClient(app) as client:
        # 1. GET /health
        print("\n[TEST 1] GET /health")
        t0 = time.perf_counter()
        res_health = client.get("/health")
        dt_health = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_health.status_code} ({dt_health:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_health.json(), indent=2))

        # 2. GET /ready
        print("\n[TEST 2] GET /ready")
        t0 = time.perf_counter()
        res_ready = client.get("/ready")
        dt_ready = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_ready.status_code} ({dt_ready:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_ready.json(), indent=2))

        # 3. POST /analyze (Positive Feedback)
        print("\n[TEST 3] POST /analyze -> Positive Feedback")
        pos_payload = {
            "text": "The professor explains concepts very clearly and with great depth."
        }
        t0 = time.perf_counter()
        res_pos = client.post("/analyze", json=pos_payload)
        dt_pos = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_pos.status_code} ({dt_pos:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_pos.json(), indent=2))

        # 4. POST /analyze (Negative Feedback on Pacing)
        print("\n[TEST 4] POST /analyze -> Negative Feedback")
        neg_payload = {
            "text": "Too fast and rushed through slides without explaining properly."
        }
        t0 = time.perf_counter()
        res_neg = client.post("/analyze", json=neg_payload)
        dt_neg = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_neg.status_code} ({dt_neg:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_neg.json(), indent=2))

        # 5. POST /analyze (Multi-Topic Feedback)
        print("\n[TEST 5] POST /analyze -> Multi-Topic Feedback")
        multi_payload = {
            "text": "Great live coding demonstrations and practical examples, but the pace is frantic and homework deadlines are too tight."
        }
        t0 = time.perf_counter()
        res_multi = client.post("/analyze", json=multi_payload)
        dt_multi = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_multi.status_code} ({dt_multi:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_multi.json(), indent=2))

        # 6. POST /analyze (Invalid Request - Whitespace)
        print("\n[TEST 6] POST /analyze -> Invalid Request (Whitespace Only)")
        inv_payload = {"text": "      \n\t   "}
        t0 = time.perf_counter()
        res_inv = client.post("/analyze", json=inv_payload)
        dt_inv = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_inv.status_code} ({dt_inv:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_inv.json(), indent=2))

        # 7. POST /analyze (Invalid Request - Extra Forbidden Identity Field)
        print("\n[TEST 7] POST /analyze -> Invalid Request (Extra Forbidden Field)")
        forbid_payload = {"text": "Good course.", "student_id": "std-12345"}
        t0 = time.perf_counter()
        res_forbid = client.post("/analyze", json=forbid_payload)
        dt_forbid = (time.perf_counter() - t0) * 1000.0
        print(f"Status Code: {res_forbid.status_code} ({dt_forbid:.2f}ms)")
        print("Response Body:")
        print(json.dumps(res_forbid.json(), indent=2))

    print("\n" + "=" * 70)
    print("MANUAL VERIFICATION COMPLETED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    run_manual_api_verification()
