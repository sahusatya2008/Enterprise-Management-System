#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.erp-runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
PY_CACHE_DIR="$RUNTIME_DIR/pycache"
VENV_DIR="$ROOT_DIR/.venv"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"
START_TIMEOUT_SECONDS=180

PORTS=(3000 4000 4101 4102 4103 4104 5001)
NODE_WORKSPACES=(
  "services/inventory-service"
  "services/hr-service"
  "services/finance-service"
  "services/sales-service"
  "backend"
  "frontend"
)

INSTALL_ONLY=0
STOP_ONLY=0
SKIP_INSTALL=0
SKIP_VALIDATE=0
DRY_RUN=0

ERP_NODE_BIN=""
ERP_PYTHON_BIN=""

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./run-erp.sh [options]

Options:
  --install-only    Install and validate everything, but do not start services.
  --skip-install    Reuse existing dependencies and skip install steps.
  --skip-validate   Skip typecheck/build validation before startup.
  --stop            Stop the ERP stack and exit.
  --dry-run         Print the actions without executing them.
  --help            Show this help message.
EOF
}

run_cmd() {
  if (( DRY_RUN )); then
    printf '+'
    for part in "$@"; do
      printf ' %q' "$part"
    done
    printf '\n'
    return 0
  fi

  "$@"
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --install-only)
        INSTALL_ONLY=1
        ;;
      --skip-install)
        SKIP_INSTALL=1
        ;;
      --skip-validate)
        SKIP_VALIDATE=1
        ;;
      --stop)
        STOP_ONLY=1
        ;;
      --dry-run)
        DRY_RUN=1
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
    shift
  done
}

ensure_runtime_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR" "$PY_CACHE_DIR"
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" && -f "$ENV_EXAMPLE_FILE" ]]; then
    log "Creating .env from .env.example"
    run_cmd cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
  fi
}

load_env() {
  ensure_env_file

  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi

  export JWT_SECRET="${JWT_SECRET:-erp-demo-secret}"
  export NEXT_PUBLIC_ERP_API_URL="${NEXT_PUBLIC_ERP_API_URL:-http://localhost:4000}"
  export INVENTORY_SERVICE_URL="${INVENTORY_SERVICE_URL:-http://localhost:4101}"
  export HR_SERVICE_URL="${HR_SERVICE_URL:-http://localhost:4102}"
  export FINANCE_SERVICE_URL="${FINANCE_SERVICE_URL:-http://localhost:4103}"
  export SALES_SERVICE_URL="${SALES_SERVICE_URL:-http://localhost:4104}"
  export ANALYTICS_SERVICE_URL="${ANALYTICS_SERVICE_URL:-http://localhost:5001}"
}

ensure_node_toolchain() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
      # shellcheck disable=SC1090
      source "$HOME/.nvm/nvm.sh"
      nvm use --silent default >/dev/null 2>&1 || nvm use --silent node >/dev/null 2>&1 || true
    fi
  fi

  command -v node >/dev/null 2>&1 || die "Node.js is required. Install Node 20+ and retry."
  command -v npm >/dev/null 2>&1 || die "npm is required. Install npm and retry."

  ERP_NODE_BIN="$(dirname "$(command -v node)")"
  export PATH="$ERP_NODE_BIN:$PATH"
}

ensure_python_toolchain() {
  if command -v python3 >/dev/null 2>&1; then
    ERP_PYTHON_BIN="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    ERP_PYTHON_BIN="$(command -v python)"
  else
    die "Python 3 is required. Install Python 3.10+ and retry."
  fi
}

stop_pid_file_processes() {
  shopt -s nullglob

  for pid_file in "$PID_DIR"/*.pid; do
    local pid
    pid="$(<"$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping tracked process $pid"
      run_cmd kill "$pid" || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        run_cmd kill -9 "$pid" || true
      fi
    fi
    run_cmd rm -f "$pid_file"
  done

  shopt -u nullglob
}

kill_port() {
  local port="$1"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null | tr '\n' ' ' || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "${port}/tcp" 2>/dev/null | tr '\n' ' ' || true)"
  fi

  if [[ -z "${pids// }" ]]; then
    return 0
  fi

  log "Freeing port $port"
  for pid in $pids; do
    run_cmd kill "$pid" || true
  done

  sleep 1

  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      run_cmd kill -9 "$pid" || true
    fi
  done
}

stop_stack() {
  ensure_runtime_dirs
  stop_pid_file_processes

  for port in "${PORTS[@]}"; do
    kill_port "$port"
  done
}

cleanup_generated_artifacts() {
  local workspace="$1"
  run_cmd rm -rf \
    "$ROOT_DIR/$workspace/node_modules" \
    "$ROOT_DIR/$workspace/dist" \
    "$ROOT_DIR/$workspace/.next" \
    "$ROOT_DIR/$workspace/tsconfig.tsbuildinfo"
}

install_node_workspace() {
  local workspace="$1"
  log "Installing dependencies for $workspace"
  (
    cd "$ROOT_DIR"
    run_cmd npm --prefix "./$workspace" install --no-fund --no-audit --workspaces=false
  )
}

install_python_dependencies() {
  if [[ ! -d "$VENV_DIR" ]]; then
    log "Creating Python virtual environment"
    run_cmd "$ERP_PYTHON_BIN" -m venv "$VENV_DIR"
  fi

  log "Installing analytics Python dependencies"
  run_cmd "$VENV_DIR/bin/python" -m pip install --upgrade pip setuptools wheel
  run_cmd "$VENV_DIR/bin/python" -m pip install -r "$ROOT_DIR/services/analytics-service/requirements.txt"
}

validate_node_workspace() {
  local workspace="$1"
  local attempt

  if (( DRY_RUN )); then
    log "Would validate $workspace"
    return 0
  fi

  for attempt in 1 2; do
    if (
      cd "$ROOT_DIR"
      npm --prefix "./$workspace" run typecheck >/dev/null
      npm --prefix "./$workspace" run build >/dev/null
    ); then
      log "Validated $workspace"
      return 0
    fi

    if (( attempt == 1 )); then
      log "Validation failed for $workspace. Reinstalling and retrying once."
      cleanup_generated_artifacts "$workspace"
      install_node_workspace "$workspace"
    fi
  done

  die "Validation still failed for $workspace."
}

validate_python_service() {
  if (( DRY_RUN )); then
    log "Would validate analytics Python service"
    return 0
  fi

  log "Validating analytics Python service"
  PYTHONPYCACHEPREFIX="$PY_CACHE_DIR" "$VENV_DIR/bin/python" -m py_compile "$ROOT_DIR/services/analytics-service/app/main.py"
}

tail_log_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    printf '\n----- %s -----\n' "$file"
    tail -n 80 "$file" || true
    printf '%s\n\n' '---------------------'
  fi
}

wait_for_health() {
  local name="$1"
  local url="$2"
  local pid_file="$3"
  local log_file="$4"
  local pid

  pid="$(<"$pid_file")"

  for _ in $(seq 1 "$START_TIMEOUT_SECONDS"); do
    if ! kill -0 "$pid" 2>/dev/null; then
      log "$name exited before becoming healthy."
      tail_log_file "$log_file"
      return 1
    fi

    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name is healthy at $url"
      return 0
    fi

    sleep 1
  done

  log "$name did not become healthy in time."
  tail_log_file "$log_file"
  return 1
}

start_process() {
  local name="$1"
  local health_url="$2"
  shift 2

  local log_file="$LOG_DIR/${name}.log"
  local pid_file="$PID_DIR/${name}.pid"

  log "Starting $name"

  if (( DRY_RUN )); then
    printf '+ start %s -> %s\n' "$name" "$health_url"
    printf '  '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi

  (
    cd "$ROOT_DIR"
    export PATH="$ERP_NODE_BIN:$PATH"
    export JWT_SECRET NEXT_PUBLIC_ERP_API_URL INVENTORY_SERVICE_URL HR_SERVICE_URL FINANCE_SERVICE_URL SALES_SERVICE_URL ANALYTICS_SERVICE_URL
    "$ERP_PYTHON_BIN" - "$ROOT_DIR" "$log_file" "$pid_file" "$@" <<'PY'
import os
import subprocess
import sys

root_dir = sys.argv[1]
log_file = sys.argv[2]
pid_file = sys.argv[3]
command = sys.argv[4:]

with open(log_file, "ab", buffering=0) as log_handle:
    process = subprocess.Popen(
        command,
        cwd=root_dir,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
        env=os.environ.copy(),
    )

with open(pid_file, "w", encoding="utf8") as pid_handle:
    pid_handle.write(str(process.pid))
PY
  )

  wait_for_health "$name" "$health_url" "$pid_file" "$log_file"
}

bootstrap_dependencies() {
  ensure_node_toolchain
  ensure_python_toolchain
  load_env

  if (( SKIP_INSTALL == 0 )); then
    for workspace in "${NODE_WORKSPACES[@]}"; do
      install_node_workspace "$workspace"
    done
    install_python_dependencies
  fi

  if (( SKIP_VALIDATE == 0 )); then
    for workspace in "${NODE_WORKSPACES[@]}"; do
      validate_node_workspace "$workspace"
    done
    validate_python_service
  fi
}

start_stack() {
  start_process "inventory-service" "http://127.0.0.1:4101/health" npm --prefix "./services/inventory-service" run dev
  start_process "hr-service" "http://127.0.0.1:4102/health" npm --prefix "./services/hr-service" run dev
  start_process "finance-service" "http://127.0.0.1:4103/health" npm --prefix "./services/finance-service" run dev
  start_process "sales-service" "http://127.0.0.1:4104/health" npm --prefix "./services/sales-service" run dev
  start_process "analytics-service" "http://127.0.0.1:5001/health" "$VENV_DIR/bin/python" -m uvicorn app.main:app --app-dir services/analytics-service --host 0.0.0.0 --port 5001 --reload
  start_process "backend" "http://127.0.0.1:4000/health" npm --prefix "./backend" run dev
  start_process "frontend" "http://127.0.0.1:3000" npm --prefix "./frontend" run dev -- --hostname 0.0.0.0 --port 3000
}

print_success() {
  cat <<EOF

ERP system is running.

Frontend:  http://localhost:3000
Backend:   http://localhost:4000
GraphQL:   http://localhost:4000/graphql
Analytics: http://localhost:5001

Logs:      $LOG_DIR
Stop:      ./run-erp.sh --stop
EOF
}

on_interrupt() {
  log "Interrupted. Cleaning up started services."
  stop_stack
  exit 130
}

trap on_interrupt INT TERM

main() {
  parse_args "$@"
  ensure_runtime_dirs

  if (( STOP_ONLY )); then
    stop_stack
    log "ERP stack stopped."
    exit 0
  fi

  stop_stack
  bootstrap_dependencies

  if (( INSTALL_ONLY )); then
    log "Install and validation completed."
    exit 0
  fi

  start_stack
  print_success
}

main "$@"
