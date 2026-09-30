#!/usr/bin/env bash

set -euo pipefail

namespace="${DEPLOY_NAMESPACE:-deploy-system}"
postgres_port="${POSTGRES_LOCAL_PORT:-15432}"
controller_port="${CONTROLLER_LOCAL_PORT:-13000}"
redis_port="${REDIS_LOCAL_PORT:-16379}"
api_port="${API_LOCAL_PORT:-18080}"
postgres_pid=''
controller_pid=''
redis_pid=''
temp_directory=''

cleanup() {
  if [[ -n "$redis_pid" ]] && kill -0 "$redis_pid" 2>/dev/null; then
    kill "$redis_pid" 2>/dev/null || true
    wait "$redis_pid" 2>/dev/null || true
  fi

  if [[ -n "$controller_pid" ]] && kill -0 "$controller_pid" 2>/dev/null; then
    kill "$controller_pid" 2>/dev/null || true
    wait "$controller_pid" 2>/dev/null || true
  fi

  if [[ -n "$postgres_pid" ]] && kill -0 "$postgres_pid" 2>/dev/null; then
    kill "$postgres_pid" 2>/dev/null || true
    wait "$postgres_pid" 2>/dev/null || true
  fi

  if [[ -n "$temp_directory" && -d "$temp_directory" ]]; then
    rm -rf "$temp_directory"
  fi
}

handle_signal() {
  exit 130
}

trap cleanup EXIT
trap handle_signal INT TERM

wait_for_port() {
  local pid="$1"
  local port="$2"
  local log_file="$3"
  local attempt=0

  until nc -z 127.0.0.1 "$port" 2>/dev/null; do
    if ! kill -0 "$pid" 2>/dev/null; then
      cat "$log_file" >&2
      return 1
    fi

    attempt=$((attempt + 1))
    if [[ "$attempt" -ge 50 ]]; then
      echo "Timed out waiting for localhost:${port}" >&2
      cat "$log_file" >&2
      return 1
    fi

    sleep 0.2
  done
}

start_postgres_forward() {
  kubectl port-forward \
    -n "$namespace" \
    service/postgres \
    "${postgres_port}:5432" \
    >"${temp_directory}/postgres.log" 2>&1 &
  postgres_pid=$!
  wait_for_port "$postgres_pid" "$postgres_port" "${temp_directory}/postgres.log"
}

start_controller_forward() {
  kubectl port-forward \
    -n "$namespace" \
    service/controller \
    "${controller_port}:3000" \
    >"${temp_directory}/controller.log" 2>&1 &
  controller_pid=$!
  wait_for_port "$controller_pid" "$controller_port" "${temp_directory}/controller.log"
}

start_redis_forward() {
  kubectl port-forward \
    -n "$namespace" \
    service/redis \
    "${redis_port}:6379" \
    >"${temp_directory}/redis.log" 2>&1 &
  redis_pid=$!
  wait_for_port "$redis_pid" "$redis_port" "${temp_directory}/redis.log"
}

load_database_url() {
  local username
  local password
  local database

  username="$(kubectl get secret deploy-database -n "$namespace" -o jsonpath='{.data.username}' | base64 --decode)"
  password="$(kubectl get secret deploy-database -n "$namespace" -o jsonpath='{.data.password}' | base64 --decode)"
  database="$(kubectl get secret deploy-database -n "$namespace" -o jsonpath='{.data.database}' | base64 --decode)"

  DATABASE_URL="$(
    DB_USERNAME="$username" \
    DB_PASSWORD="$password" \
    DB_DATABASE="$database" \
    DB_PORT="$postgres_port" \
    node -e '
      const url = new URL("postgresql://127.0.0.1")
      url.username = process.env.DB_USERNAME
      url.password = process.env.DB_PASSWORD
      url.port = process.env.DB_PORT
      url.pathname = process.env.DB_DATABASE
      process.stdout.write(url.toString())
    '
  )"
  export DATABASE_URL
}

run_migrations() {
  npm --prefix api run db:migrate
}

main() {
  local command="${1:-}"

  case "$command" in
    dev|migrate)
      ;;
    *)
      echo "Usage: $0 {dev|migrate}" >&2
      exit 2
      ;;
  esac

  temp_directory="$(mktemp -d)"
  start_postgres_forward
  load_database_url
  run_migrations

  if [[ "$command" == 'dev' ]]; then
    start_controller_forward
    start_redis_forward
    PORT="$api_port" \
    BETTER_AUTH_URL="http://127.0.0.1:${api_port}" \
    BETTER_AUTH_TRUSTED_ORIGINS="http://127.0.0.1:${api_port}" \
    AUTH_SIGN_UP_ENABLED="${AUTH_SIGN_UP_ENABLED:-true}" \
    CONTROLLER_URL="http://127.0.0.1:${controller_port}" \
    REDIS_HOST=127.0.0.1 \
    REDIS_PORT="$redis_port" \
    npm --prefix api run dev
  fi
}

main "$@"
