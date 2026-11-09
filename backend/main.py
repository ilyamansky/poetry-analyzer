# backend/main.py
import logging
import os
import re
import threading
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pymorphy3

# ============================================================
# pymorphy3
# ============================================================
print("Инициализация морфологического анализатора...")
morph = pymorphy3.MorphAnalyzer()

# ============================================================
# RPST
# ============================================================
# RPST — тяжёлая CPU-bound модель. Ограничиваем число одновременных
# RPST-вызовов ОДНИМ на воркер (Semaphore(1)). При gunicorn -w 2 итого
# на сервере — не более 2 параллельных RPST, что ровно по числу ядер
# на тарифе 2 vCPU. Если переедете на 4 vCPU — увеличьте -w до 4;
# семафор по-прежнему 1 на воркер, итого 4 параллельных RPST.
#
# Lazy/eager загрузка модели:
# - RPST_EAGER=1 (Docker/production): грузим сразу при импорте, до форка
#   воркеров. С --preload все воркеры наследуют модель через copy-on-write.
#   Первый пользователь не ждёт.
# - Без переменной (dev, uvicorn --reload): ленивая загрузка при первом
#   запросе, чтобы каждое сохранение файла не ждало 30+ секунд.
_rpst_tool = None
_rpst_sem = threading.Semaphore(1)


def _load_rpst():
    global _rpst_tool
    if _rpst_tool is not None:
        return _rpst_tool

    print("Загрузка RPST...")
    import russian_scansion

    # Модели могут лежать в двух местах:
    # - backend/models/ (локально, если вы их скачали руками)
    # - site-packages/russian_scansion/models/ (при pip install из git)
    # Проверяем наличие локальной папки; если нет — RPST ищет сам.
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    if os.path.isdir(models_dir):
        print(f"RPST: используем локальные модели {models_dir}")
        _rpst_tool = russian_scansion.create_rpst_instance(models_dir=models_dir)
    else:
        print("RPST: локальная папка models/ не найдена, используем встроенные")
        _rpst_tool = russian_scansion.create_rpst_instance()

    print("RPST загружен.")
    return _rpst_tool


def get_rpst_tool():
    return _load_rpst()


_RPST_EAGER = os.environ.get("RPST_EAGER") == "1"
if _RPST_EAGER:
    print("[RPST EAGER] загрузка модели при старте (RPST_EAGER=1)")
    _load_rpst()
else:
    print("[RPST LAZY] загрузка модели при первом запросе")


# ============================================================
# FastAPI
# ============================================================
app = FastAPI(title="Poetry Analyzer API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://stihoskop.ru",
    "https://www.stihoskop.ru",
    "http://stihoskop.ru",
    "http://www.stihoskop.ru",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # На случай preview-деплоев Vercel или тестов по IP
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AnalysisMode = Literal["full", "lemmas"]


class AnalyzeRequest(BaseModel):
    text: str
    mode: AnalysisMode = "full"


class TokenAnalysis(BaseModel):
    original: str
    lemma: str
    pos: str
    score: float


class AnalyzeResponse(BaseModel):
    lemmas: List[str]
    tokens: List[TokenAnalysis]
    meter: Optional[str] = None
    rhyme_scheme: Optional[str] = None
    scansion_score: Optional[float] = None
    stressed_lines: Optional[List[str]] = None


class BatchItem(BaseModel):
    id: str
    text: str
    mode: AnalysisMode = "full"


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


def scan_text(text: str) -> AnalyzeResponse:
    """RPST: размер, рифма, ударения. При сбое — поля null.

    Вызывать только внутри `with _rpst_sem:` — семафор контролирует
    в analyze_text, а не здесь, чтобы было видно, что RPST — тяжёлый.
    """
    try:
        tool = get_rpst_tool()
        lines = [line for line in text.split("\n") if line.strip()]
        if not lines:
            return AnalyzeResponse(lemmas=[], tokens=[])

        scansion = tool.align(lines)

        stressed_raw = scansion.get_stressed_lines(show_secondary_accentuation=True)
        stressed_lines = (
            stressed_raw.splitlines() if isinstance(stressed_raw, str) else stressed_raw
        )

        return AnalyzeResponse(
            lemmas=[],
            tokens=[],
            meter=getattr(scansion, "meter", None),
            rhyme_scheme=getattr(scansion, "rhyme_scheme", None),
            scansion_score=getattr(scansion, "score", None),
            stressed_lines=stressed_lines,
        )
    except Exception:
        logging.exception("RPST analysis failed")
        return AnalyzeResponse(lemmas=[], tokens=[])


def analyze_text(text: str, mode: AnalysisMode) -> AnalyzeResponse:
    lemmas, tokens = lemmatize_text(text)

    if mode == "lemmas":
        return AnalyzeResponse(lemmas=lemmas, tokens=tokens)

    # RPST — под семафором. Лемматизация выше идёт без него (она быстрая).
    with _rpst_sem:
        scansion = scan_text(text)

    return AnalyzeResponse(
        lemmas=lemmas,
        tokens=tokens,
        meter=scansion.meter,
        rhyme_scheme=scansion.rhyme_scheme,
        scansion_score=scansion.scansion_score,
        stressed_lines=scansion.stressed_lines,
    )


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
