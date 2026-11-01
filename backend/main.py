# backend/main.py
import logging
import os
import re
import time
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pymorphy3

# --- Морфологический анализатор (быстрый, инициализируем сразу) ---
print("Инициализация морфологического анализатора...")
_t_morph = time.perf_counter()
morph = pymorphy3.MorphAnalyzer()
print(f"[INIT] pymorphy3 loaded in {time.perf_counter() - _t_morph:.3f}s")

# --- RPST: ленивый (dev) или нетерпеливый (production) ---
# Управляется переменной окружения RPST_EAGER=1.
# - dev (uvicorn --reload): без переменной → ленивая загрузка, чтобы
#   каждое сохранение файла не ждало 30+ секунд перезагрузки модели.
# - production (gunicorn --preload -w 4): с RPST_EAGER=1 → модель грузится
#   в master-процесс до форка воркеров, все воркеры наследуют её через
#   copy-on-write. Первый пользователь не ждёт.
_rpst_tool = None


def _load_rpst():
    """Загружает RPST и возвращает tool. Вызывается один раз."""
    global _rpst_tool
    if _rpst_tool is not None:
        return _rpst_tool
    print("Загрузка RPST...")
    _t_load = time.perf_counter()
    import russian_scansion

    models_dir = os.path.join(os.path.dirname(__file__), "models")
    print(f"Модели: {models_dir}")
    _rpst_tool = russian_scansion.create_rpst_instance(models_dir=models_dir)
    print(f"[RPST LOAD] done in {time.perf_counter() - _t_load:.3f}s")
    return _rpst_tool


def get_rpst_tool():
    """Возвращает RPST, загружая при первом вызове (если ещё не загружен)."""
    return _load_rpst()


_RPST_EAGER = os.environ.get("RPST_EAGER") == "1"
if _RPST_EAGER:
    # production: грузим сразу, до старта сервера и форка воркеров.
    print("[RPST EAGER] RPST_EAGER=1 → загрузка при старте")
    _load_rpst()
else:
    print("[RPST LAZY] RPST_EAGER!=1 → загрузка при первом запросе")


app = FastAPI(title="Poetry Analyzer API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

# Счётчик запросов для логов
_analyze_counter = 0


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
    """Разбор RPST: размер, рифма, ударения. При сбое — поля null."""
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
    global _analyze_counter
    _analyze_counter += 1
    counter = _analyze_counter

    t_start = time.perf_counter()
    lemmas, tokens = lemmatize_text(text)
    t_lemmas = time.perf_counter()

    if mode == "lemmas":
        dur_lemmas = t_lemmas - t_start
        print(
            f"[ANALYZE #{counter}] mode=lemmas total={dur_lemmas:.3f}s "
            f"lemmas={dur_lemmas:.3f}s rpst=0.000s"
        )
        return AnalyzeResponse(lemmas=lemmas, tokens=tokens)

    scansion = scan_text(text)
    t_rpst = time.perf_counter()
    dur_lemmas = t_lemmas - t_start
    dur_rpst = t_rpst - t_lemmas
    dur_total = t_rpst - t_start
    print(
        f"[ANALYZE #{counter}] mode=full total={dur_total:.3f}s "
        f"lemmas={dur_lemmas:.3f}s rpst={dur_rpst:.3f}s"
    )
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

    t_batch = time.perf_counter()
    ok = 0
    err = 0

    results: List[BatchResult] = []
    for item in request.items:
        if not item.text.strip():
            results.append(
                BatchResult(
                    id=item.id, lemmas=[], tokens=[], error="Text cannot be empty."
                )
            )
            err += 1
            continue
        try:
            response = analyze_text(item.text, item.mode)
            results.append(BatchResult(id=item.id, **response.model_dump()))
            ok += 1
        except Exception as e:
            logging.exception("Batch item failed: %s", item.id)
            results.append(BatchResult(id=item.id, lemmas=[], tokens=[], error=str(e)))
            err += 1

    dur_batch = time.perf_counter() - t_batch
    n = len(request.items)
    avg = dur_batch / n if n > 0 else 0
    print(
        f"[BATCH] n={n} ok={ok} err={err} "
        f"total={dur_batch:.3f}s avg={avg:.3f}s/item"
    )

    return BatchResponse(results=results)
