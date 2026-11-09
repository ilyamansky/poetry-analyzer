FROM python:3.11-slim

# Системные зависимости для сборки russian_scansion (torch, git-lfs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Сначала только requirements — чтобы кэшировать слой
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

# Потом код
COPY . .

# Модель RPST: грузим при старте контейнера, не при первом запросе
ENV RPST_EAGER=1

EXPOSE 8000

# --preload: модель загружается в master-процесс до форка воркеров,
# все воркеры делят её через copy-on-write. --timeout 120 — для
# длинных батчей (на всякий случай).
CMD ["gunicorn", "main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "--preload", \
     "--timeout", "120", \
     "--bind", "0.0.0.0:8000"]