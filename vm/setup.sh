#!/bin/bash
# setup.sh - Download v86 engine files and build the tutorial VM image
# Usage: ./vm/setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
V86_DIR="$PROJECT_DIR/assets/v86"
DIST_DIR="$SCRIPT_DIR/dist"

echo "=== Tutorial VM Setup ==="
echo ""

# -------------------------------------------------------
# Step 1: Download v86 engine (libv86.js, v86.wasm, BIOS)
# -------------------------------------------------------
echo "--- Step 1: Downloading v86 engine ---"
mkdir -p "$V86_DIR"

# Try downloading from the latest GitHub release
RELEASE_URL="https://api.github.com/repos/copy/v86/releases/latest"
echo "Fetching latest v86 release info..."
RELEASE_JSON=$(curl -sS "$RELEASE_URL" 2>/dev/null || echo "{}")

LIBV86_URL=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for asset in data.get('assets', []):
        if asset['name'] == 'libv86.js':
            print(asset['browser_download_url'])
            break
except: pass
" 2>/dev/null || echo "")

V86WASM_URL=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for asset in data.get('assets', []):
        if asset['name'] == 'v86.wasm':
            print(asset['browser_download_url'])
            break
except: pass
" 2>/dev/null || echo "")

if [ -n "$LIBV86_URL" ] && [ -n "$V86WASM_URL" ]; then
    echo "Downloading libv86.js from release..."
    curl -L --progress-bar -o "$V86_DIR/libv86.js" "$LIBV86_URL"
    echo "Downloading v86.wasm from release..."
    curl -L --progress-bar -o "$V86_DIR/v86.wasm" "$V86WASM_URL"
else
    echo ""
    echo "Could not find release assets. Building v86 from source..."
    echo "This requires: rust, make, clang, java (closure compiler)"
    echo ""
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    git clone --depth 1 https://github.com/copy/v86.git "$TEMP_DIR/v86"
    cd "$TEMP_DIR/v86"
    make build/libv86.js build/v86.wasm
    cp build/libv86.js "$V86_DIR/"
    cp build/v86.wasm "$V86_DIR/"
    cd "$PROJECT_DIR"
    rm -rf "$TEMP_DIR"
    trap - EXIT
fi

# Download BIOS files from v86 repository
echo "Downloading BIOS files..."
curl -sS -L -o "$V86_DIR/seabios.bin" \
    "https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin"
curl -sS -L -o "$V86_DIR/vgabios.bin" \
    "https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin"

echo "v86 engine ready: $V86_DIR"
ls -lh "$V86_DIR"

# -------------------------------------------------------
# Step 2: Build VM image (kernel + rootfs)
# -------------------------------------------------------
echo ""
echo "--- Step 2: Building VM image ---"

if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is required to build the VM image."
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "v86 engine files were downloaded successfully."
    echo "Re-run this script after installing Docker to build the VM image."
    exit 1
fi

"$SCRIPT_DIR/build-rootfs.sh"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "  v86 engine: $V86_DIR/"
echo "  VM kernel:  $DIST_DIR/bzImage"
echo "  VM rootfs:  $DIST_DIR/rootfs.cpio.gz"
echo ""
echo "Start the dev server with: make run"
echo "Then open: http://localhost:4000/SEBook/tools/shell-tutorial"
