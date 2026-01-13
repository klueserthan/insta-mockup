# Insta Mockup Makefile

SHELL := /bin/bash

# Directories
BACKEND_DIR := backend
FRONTEND_DIR := frontend
LOG_DIR := .logs
PID_DIR := .pids

# Hosts and ports
BACKEND_HOST := 0.0.0.0
BACKEND_PORT ?= 8000
FRONTEND_HOST := 0.0.0.0
FRONTEND_PORT ?= 5173

# Environment variables loaded from backend/.env by python-dotenv

.PHONY: setup setup-backend setup-frontend start start-backend start-frontend stop stop-backend stop-frontend status logs backend frontend open test backend-tests frontend-tests typecheck clean

setup: setup-backend setup-frontend
	@echo "Setup complete."

setup-backend:
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@echo "Syncing Python deps in $(BACKEND_DIR)..."
	@cd $(BACKEND_DIR) && uv sync

setup-frontend:
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@echo "Installing Node deps in $(FRONTEND_DIR)..."
	@cd $(FRONTEND_DIR) && npm install

start: start-backend start-frontend
	@echo "Backend and frontend started. Visit http://localhost:$(FRONTEND_PORT)"

start-backend:
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@echo "Starting backend on $(BACKEND_HOST):$(BACKEND_PORT)..."
	@cd $(BACKEND_DIR) && \
		nohup uv run uvicorn main:app --reload --host $(BACKEND_HOST) --port $(BACKEND_PORT) > $(CURDIR)/$(LOG_DIR)/backend.log 2>&1 & echo $$! > $(CURDIR)/$(PID_DIR)/backend.pid
	@sleep 1
	@echo "Backend PID: $$(cat $(PID_DIR)/backend.pid 2>/dev/null || echo 'n/a')"

start-frontend:
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@echo "Starting frontend on $(FRONTEND_HOST):$(FRONTEND_PORT)..."
	@cd $(FRONTEND_DIR) && \
		nohup npm run dev -- --host $(FRONTEND_HOST) --port $(FRONTEND_PORT) > $(CURDIR)/$(LOG_DIR)/frontend.log 2>&1 & echo $$! > $(CURDIR)/$(PID_DIR)/frontend.pid
	@sleep 1
	@echo "Frontend PID: $$(cat $(PID_DIR)/frontend.pid 2>/dev/null || echo 'n/a')"

stop: stop-frontend stop-backend
	@echo "Stopped both services."

stop-backend:
	@echo "Stopping backend..."
	@if [ -f $(PID_DIR)/backend.pid ]; then PID=$$(cat $(PID_DIR)/backend.pid); kill $$PID || true; rm -f $(PID_DIR)/backend.pid; fi
	@pkill -f "uvicorn main:app" || true
	@echo "Backend stopped."

stop-frontend:
	@echo "Stopping frontend..."
	@if [ -f $(PID_DIR)/frontend.pid ]; then PID=$$(cat $(PID_DIR)/frontend.pid); kill $$PID || true; rm -f $(PID_DIR)/frontend.pid; fi
	@pkill -f "vite" || true
	@echo "Frontend stopped."

status:
	@echo "Processes:"
	@ps -o pid,comm,command -p $$(cat $(PID_DIR)/backend.pid 2>/dev/null) 2>/dev/null || echo "Backend not running"
	@ps -o pid,comm,command -p $$(cat $(PID_DIR)/frontend.pid 2>/dev/null) 2>/dev/null || echo "Frontend not running"

logs:
	@echo "Tailing logs (Ctrl+C to exit)..."
	@tail -n +1 -f $(LOG_DIR)/backend.log $(LOG_DIR)/frontend.log

backend:
	@cd $(BACKEND_DIR) && uv run uvicorn main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT)

backend-dev:
	@cd $(BACKEND_DIR) && uv run uvicorn main:app --reload --host $(BACKEND_HOST) --port $(BACKEND_PORT)

frontend:
	@cd $(FRONTEND_DIR) && npm run dev -- --host $(FRONTEND_HOST) --port $(FRONTEND_PORT)

open:
	@open http://localhost:$(FRONTEND_PORT)

test: backend-tests frontend-tests

backend-tests:
	@cd $(BACKEND_DIR) && uv run pytest -q

frontend-tests:
	@cd $(FRONTEND_DIR) && npm test

typecheck:
	@cd $(BACKEND_DIR) && uv run pyright .
	@cd $(FRONTEND_DIR) && npm run check

clean:
	@rm -rf $(PID_DIR) $(LOG_DIR)
