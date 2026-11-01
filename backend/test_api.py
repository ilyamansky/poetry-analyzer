# backend/test_api.py
import json
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8000"


def post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


text = """Мороз и солнце; день чудесный!
Еще ты дремлешь, друг прелестный?
Пора, красавица, проснись:
Открой сомкнуты негой взоры"""

text2 = """Мой дядя самых честных правил,
Когда не в шутку занемог,
Он уважать себя заставил
И лучше выдумать не мог."""

print("=== /api/analyze (mode=lemmas) ===")
lemmas_result = post("/api/analyze", {"text": text, "mode": "lemmas"})
assert lemmas_result["lemmas"], "lemmas пустые"
assert lemmas_result["tokens"], "tokens пустые"
assert lemmas_result["meter"] is None, "meter должен быть null в режиме lemmas"
assert lemmas_result["rhyme_scheme"] is None
assert lemmas_result["scansion_score"] is None
assert lemmas_result["stressed_lines"] is None
print("lemmas:", lemmas_result["lemmas"][:10])
print("meter:", lemmas_result["meter"])
print("OK")

print("\n=== /api/analyze (mode=full, по умолчанию) ===")
full_result = post("/api/analyze", {"text": text})
print("lemmas:", full_result["lemmas"][:10])
print("meter:", full_result["meter"])
print("rhyme_scheme:", full_result["rhyme_scheme"])
print("scansion_score:", full_result["scansion_score"])
print("stressed_lines:")
if full_result["stressed_lines"]:
    for line in full_result["stressed_lines"]:
        print(" ", line)
else:
    print("  (пусто)")
assert full_result["lemmas"], "lemmas пустые"

print("\n=== /api/analyze-batch ===")
batch_result = post(
    "/api/analyze-batch",
    {
        "items": [
            {"id": "p1", "text": text, "mode": "lemmas"},
            {"id": "p2", "text": "   ", "mode": "lemmas"},
        ]
    },
)
results = {r["id"]: r for r in batch_result["results"]}
assert len(batch_result["results"]) == 2

r1 = results["p1"]
assert r1["error"] is None
assert r1["lemmas"], "lemmas пустые у p1"
assert r1["meter"] is None
print("p1: lemmas:", r1["lemmas"][:10], "| error:", r1["error"])

r2 = results["p2"]
assert r2["error"] is not None, "пустой текст должен давать per-item error"
assert r2["lemmas"] == []
assert r2["tokens"] == []
print("p2: error:", r2["error"])
print("OK")

print("\nВсе проверки пройдены.")
