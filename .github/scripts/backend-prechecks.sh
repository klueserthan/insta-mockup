#!/usr/bin/env bash
# Pre-commit checks for insta-mockup backend
# Runs lint, type-check, format, and tests via uv from the backend directory
set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

run_check() {
    local step_num=$1
    local step_name=$2
    shift 2

    echo -e "${BLUE}${step_num} ${step_name}...${NC}"
    if "$@"; then
        echo -e "${GREEN}OK ${step_name}${NC}\n"
    else
        echo -e "${RED}FAIL ${step_name}${NC}\n"
        exit 1
    fi
}

if ! command -v uv >/dev/null 2>&1; then
    echo -e "${RED}Error: uv is not installed. Install from https://github.com/astral-sh/uv${NC}"
    exit 1
fi

cd "$BACKEND_DIR"

# Default the required env var for imports/tests if not already set
export ROCKET_API_KEY=${ROCKET_API_KEY:-dummy}

run_check "1" "Dependency sync (dev extras)" uv sync --group dev
run_check "2" "Type checking (pyright)" uv run pyright .
run_check "3" "Code formatting (ruff format)" uv run ruff format .
run_check "4" "Linting (ruff check --fix)" uv run ruff check --fix .
run_check "5" "Tests (pytest)" uv run pytest

echo -e "${GREEN}All backend checks passed. You can commit now.${NC}"
