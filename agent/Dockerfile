# build from the agent/ folder after copying ../content in (see deploy.sh)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    HF_HOME=/app/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ python3-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN mkdir -p src && uv sync --locked --no-dev --no-install-project

COPY . .
RUN uv sync --locked --no-dev && uv run python -m ustaad_agent download-files

RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

CMD ["uv", "run", "python", "-m", "ustaad_agent", "start"]
