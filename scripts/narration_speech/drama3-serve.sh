#!/usr/bin/env bash
# Start a Fish Audio Drama 3 speech server (sglang-omni) on the GPU host and wait until it answers.
# Run it on that host; the renderer reaches it through a forwarded port (docs/narration-format.md).
# The defaults fit an NVIDIA DGX Spark (GB10, CUDA 13); override them through the environment:
#   DRAMA3_VENV   virtualenv with sglang-omni installed       (default ~/drama3/venv)
#   DRAMA3_MODEL  local snapshot of fishaudio/drama-3          (required)
#   DRAMA3_PORT   port bound on 127.0.0.1                      (default 8000)
#   DRAMA3_LOG    server log                                   (default ~/drama3/server.log)
#   CUDA_HOME     CUDA toolkit with nvcc for FlashInfer's JIT  (default /usr/local/cuda-13.0)
# The server keeps running after this script exits; its process ID is written next to the log.
set -euo pipefail
VENV="${DRAMA3_VENV:-$HOME/drama3/venv}"
MODEL="${DRAMA3_MODEL:?set DRAMA3_MODEL to the fishaudio/drama-3 snapshot directory}"
PORT="${DRAMA3_PORT:-8000}"
LOG="${DRAMA3_LOG:-$HOME/drama3/server.log}"
export CUDA_HOME="${CUDA_HOME:-/usr/local/cuda-13.0}"
export PATH="$VENV/bin:$CUDA_HOME/bin:$PATH"
# FlashInfer's GB10 build: compile for sm_121a and use the CUDA normalization kernels.
export FLASHINFER_CUDA_ARCH_LIST="${FLASHINFER_CUDA_ARCH_LIST:-12.1a}" FLASHINFER_USE_CUDA_NORM=1

health() { curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/health" || true; }
[ "$(health)" = 000 ] || { echo "Port $PORT already answers; not starting a second server." >&2; exit 1; }
mkdir -p "$(dirname "$LOG")"
setsid "$VENV/bin/sgl-omni" serve --model-path "$MODEL" --host 127.0.0.1 --port "$PORT" \
  --vocoder.factory.codec_path "$MODEL" \
  --tts_engine.gpu_memory_fraction 0.50 --vocoder.gpu_memory_fraction 0.06 \
  > "$LOG" 2>&1 < /dev/null &
server=$!
echo "$server" > "${LOG%.log}.pid"
echo "Drama 3 server $server starting; log: $LOG"
for second in $(seq 1 1800); do
  if [ "$(health)" = 200 ]; then echo "Drama 3 ready after ${second}s on port $PORT"; exit 0; fi
  if ! kill -0 "$server" 2>/dev/null; then echo "Drama 3 server exited; last log lines:" >&2; tail -30 "$LOG" >&2; exit 1; fi
  sleep 1
done
echo "Drama 3 did not become ready within 30 minutes; see $LOG" >&2
exit 1
