import urllib.request, json

payload = {
    "session_id": "test-session-001",
    "eda_result": {
        "summary": {"total_rows": 1500, "source_type": "myvass"},
        "quality": {"overall_score": 0.78, "missing_rate": 0.12},
        "indicators": {
            "stunting_rate": 0.24,
            "wasting_rate": 0.11,
            "underweight_rate": 0.18,
            "severe_stunting_rate": 0.08
        },
        "outliers": {"total_flagged": 43},
        "by_negeri": {
            "Selangor": 320,
            "Johor": 280,
            "Perak": 210,
            "Kedah": 190,
            "Sabah": 170
        }
    }
}

data = json.dumps(payload).encode()
req = urllib.request.Request(
    "http://localhost:8000/ai/narrative",
    data=data,
    headers={"Content-Type": "application/json"}
)

print("Calling /ai/narrative ... (may take 30-60s)")
response = urllib.request.urlopen(req, timeout=180)
result = json.loads(response.read().decode())
print(json.dumps(result, indent=2, ensure_ascii=False))
