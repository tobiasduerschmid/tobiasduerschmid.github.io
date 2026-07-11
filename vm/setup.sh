#!/bin/bash
# setup.sh - Download v86 engine files and build the tutorial VM image
# Usage: ./vm/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
V86_DIR="$PROJECT_DIR/assets/v86"
DIST_DIR="$SCRIPT_DIR/dist"
BUILD_INPUTS="$SCRIPT_DIR/build-inputs.env"

if [ ! -r "$BUILD_INPUTS" ]; then
    echo "ERROR: Missing VM build input manifest: $BUILD_INPUTS" >&2
    exit 1
fi

# shellcheck disable=SC1090 -- the repository-owned manifest is the contract.
. "$BUILD_INPUTS"

sha256_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

verify_pinned_artifact() {
    local artifact_path="$1"
    local expected_sha256="$2"
    local artifact_name
    local actual_sha256
    artifact_name="$(basename "$artifact_path")"

    if [ ! -f "$artifact_path" ]; then
        echo "ERROR: Missing repository-pinned v86 artifact: $artifact_path" >&2
        echo "Restore it from Git before running VM setup." >&2
        exit 1
    fi

    actual_sha256="$(sha256_file "$artifact_path")"
    if [ "$actual_sha256" != "$expected_sha256" ]; then
        echo "ERROR: Integrity check failed for $artifact_name" >&2
        echo "  expected: $expected_sha256" >&2
        echo "  actual:   $actual_sha256" >&2
        echo "Refresh build-inputs.env only as part of a reviewed dependency update." >&2
        exit 1
    fi
    echo "Verified $artifact_name"
}

echo "=== Tutorial VM Setup ==="
echo ""

# -------------------------------------------------------
# Step 1: Verify the repository-pinned v86 engine and BIOS
# -------------------------------------------------------
echo "--- Step 1: Verifying v86 engine ---"
verify_pinned_artifact "$V86_DIR/libv86.js" "$V86_LIBV86_SHA256"
verify_pinned_artifact "$V86_DIR/v86.wasm" "$V86_WASM_SHA256"
verify_pinned_artifact "$V86_DIR/seabios.bin" "$V86_SEABIOS_SHA256"
verify_pinned_artifact "$V86_DIR/vgabios.bin" "$V86_VGABIOS_SHA256"

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
