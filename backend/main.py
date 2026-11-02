# backend/main.py
import logging
import re
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pymorphy3

# ============================================================
# Морфологический анализатор (pymorphy3)
# ============================================================
print("Инициализация морфологического анализатора...")
morph = pymorphy3.MorphAnalyzer()

# ============================================================
# RPST — ВРЕМЕННО ОТКЛЮЧЁН ДЛЯ ДЕПЛОЯ НА VERCEL
# ============================================================
# Причина: RPST — тяжёлая CPU-bound модель (~500 МБ, ~36 сек на загрузку,
# ~0.3 сек на стих). Не влезает в бесплатные лимиты Vercel и требует
# сервера с достаточной RAM и CPU. Бэкенд теперь работает только в режиме
# лемматизации. Всё остальное (сеть, дисперсия, коллокации, keyness,
# повторы, похожие стихи и т.д.) считается на фронтенде в браузере.
#
# Чтобы вернуть RPST:
#   1. Раскомментировать блок ниже и импорты `os`, `time`.
#   2. Раскомментировать `scan_text` и ветку mode="full" в `analyze_text`.
#   3. Вернуть `russian_scansion` в requirements.txt.
#   4. Развернуть не на Vercel, а на сервере с RAM ≥ 4 ГБ.
#   5. Собрать фронт без режима "lemmas-only".
# ============================================================

# import os
# import time
#
# _rpst_tool = None
#
#
# def _load_rpst():
#     """Загружает RPST и возвращает tool. Вызывается один раз."""
#     global _rpst_tool
#     if _rpst_tool is not None:
#         return _rpst_tool
#     print("Загрузка RPST...")
#     t_load = time.perf_counter()
#     import russian_scansion
#
#     models_dir = os.path.join(os.path.dirname(__file__), "models")
#     print(f"Модели: {models_dir}")
#     _rpst_tool = russian_scansion.create_rpst_instance(models_dir=models_dir)
#     print(f"[RPST LOAD] done in {time.perf_counter() - t_load:.3f}s")
#     return _rpst_tool
#
#
# def get_rpst_tool():
#     """Возвращает RPST, загружая при первом вызове (если ещё не загружен)."""
#     return _load_rpst()
#
#
# _RPST_EAGER = os.environ.get("RPST_EAGER") == "1"
# if _RPST_EAGER:
#     print("[RPST EAGER] RPST_EAGER=1 → загрузка при старте")
#     _load_rpst()
# else:
#     print("[RPST LAZY] RPST_EAGER!=1 → загрузка при первом запросе")


app = FastAPI(title="Poetry Analyzer API")

# ─── CORS ────────────────────────────────────────────────────────────────
# allow_origins — явный список разрешённых доменов фронтенда.
# allow_origin_regex — на случай, если Vercel выдаст preview-домен
# с другим хешем (например, poetry-analyzer-f919-<hash>-...vercel.app).
# Regex покрывает все preview и production URL проекта:
#   poetry-analyzer-f919.vercel.app
#   poetry-analyzer-f919-git-main-ilyamanskys-projects.vercel.app
#   poetry-analyzer-f919-kzvfvftpm-ilyamanskys-projects.vercel.app
#   ...любой будущий preview этого проекта
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://poetry-analyzer-f919.vercel.app",
    "https://poetry-analyzer-f919-git-main-ilyamanskys-projects.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://poetry-analyzer-f919.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AnalysisMode = Literal["full", "lemmas"]


class AnalyzeRequest(BaseModel):
    text: str
    mode: AnalysisMode = "lemmas"


class TokenAnalysis(BaseModel):
    original: str
    lemma: str
    pos: str
    score: float


class AnalyzeResponse(BaseModel):
    lemmas: List[str]
    tokens: List[TokenAnalysis]
    # Поля ниже оставлены для совместимости с фронтом (он их читает как null).
    # Пока RPST отключён — всегда None.
    meter: Optional[str] = None
    rhyme_scheme: Optional[str] = None
    scansion_score: Optional[float] = None
    stressed_lines: Optional[List[str]] = None


class BatchItem(BaseModel):
    id: str
    text: str
    mode: AnalysisMode = "lemmas"


class BatchRequest(BaseModel):
    items: List[BatchItem]


class BatchResult(AnalyzeResponse):
    id: str
    error: Optional[str] = None


class BatchResponse(BaseModel):
    results: List[BatchResult]


MAX_BATCH_ITEMS = 50


def lemmatize_text(text: str) -> tuple[List[str], List[TokenAnalysis]]:
    raw_tokens = [t for t in text.lower().replace("\n", " ").split() if t]

    token_analyses: List[TokenAnalysis] = []
    lemmas: List[str] = []

    for token in raw_tokens:
        clean_token = re.sub(r"^[^\w]+|[^\w]+$", "", token)
        if not clean_token:
            continue

        parsed = morph.parse(clean_token)[0]
        token_analyses.append(
            TokenAnalysis(
                original=clean_token,
                lemma=parsed.normal_form,
                pos=str(parsed.tag.POS) if parsed.tag.POS else "UNKN",
                score=parsed.score,
            )
        )
        lemmas.append(parsed.normal_form)

    return lemmas, token_analyses


# ============================================================
# RPST — scan_text (закомментирован вместе с остальным RPST)
# ============================================================
# def scan_text(text: str) -> AnalyzeResponse:
#     """Разбор RPST: размер, рифма, ударения. При сбое — поля null."""
#     try:
#         tool = get_rpst_tool()
#         lines = [line for line in text.split("\n") if line.strip()]
#         if not lines:
#             return AnalyzeResponse(lemmas=[], tokens=[])
#
#         scansion = tool.align(lines)
#
#         stressed_raw = scansion.get_stressed_lines(show_secondary_accentuation=True)
#         stressed_lines = (
#             stressed_raw.splitlines() if isinstance(stressed_raw, str) else stressed_raw
#         )
#
#         return AnalyzeResponse(
#             lemmas=[],
#             tokens=[],
#             meter=getattr(scansion, "meter", None),
#             rhyme_scheme=getattr(scansion, "rhyme_scheme", None),
#             scansion_score=getattr(scansion, "score", None),
#             stressed_lines=stressed_lines,
#         )
#     except Exception:
#         logging.exception("RPST analysis failed")
#         return AnalyzeResponse(lemmas=[], tokens=[])


def analyze_text(text: str, mode: AnalysisMode) -> AnalyzeResponse:
    """Пока RPST отключён — всегда только лемматизация.

    Параметр `mode` принимается для совместимости с фронтом (он шлёт
    "full" или "lemmas"), но игнорируется: оба режима дают одинаковый
    результат. Когда RPST вернётся — здесь снова появится ветка if.
    """
    _ = mode  # намеренно игнорируем
    lemmas, tokens = lemmatize_text(text)
    return AnalyzeResponse(lemmas=lemmas, tokens=tokens)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Poetry Analyzer API is running."}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_poem(request: AnalyzeRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    return analyze_text(request.text, request.mode)


@app.post("/api/analyze-batch", response_model=BatchResponse)
def analyze_batch(request: BatchRequest):
    if len(request.items) > MAX_BATCH_ITEMS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many items: {len(request.items)} (max {MAX_BATCH_ITEMS}).",
        )

    results: List[BatchResult] = []
    for item in request.items:
        if not item.text.strip():
            results.append(
                BatchResult(
                    id=item.id, lemmas=[], tokens=[], error="Text cannot be empty."
                )
            )
            continue
        try:
            response = analyze_text(item.text, item.mode)
            results.append(BatchResult(id=item.id, **response.model_dump()))
        except Exception as e:
            logging.exception("Batch item failed: %s", item.id)
            results.append(BatchResult(id=item.id, lemmas=[], tokens=[], error=str(e)))

    return BatchResponse(results=results)
