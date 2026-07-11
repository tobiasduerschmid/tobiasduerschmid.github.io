#!/bin/bash
# build-rootfs.sh - Build Alpine Linux rootfs and extract kernel for v86
# Requires: Docker
#
# Installs packages directly into an Alpine container, then exports the
# entire filesystem as a cpio initrd. This ensures all shared libraries
# and dependencies are properly resolved.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
OVERLAY_DIR="$SCRIPT_DIR/overlay"
BUILD_INPUTS="$SCRIPT_DIR/build-inputs.env"
APK_RUNTIME_LOCK="$SCRIPT_DIR/apk-runtime.lock"

if [ ! -r "$BUILD_INPUTS" ]; then
    echo "ERROR: Missing VM build input manifest: $BUILD_INPUTS" >&2
    exit 1
fi
if [ ! -r "$APK_RUNTIME_LOCK" ]; then
    echo "ERROR: Missing VM package closure lock: $APK_RUNTIME_LOCK" >&2
    exit 1
fi

# shellcheck disable=SC1090 -- the repository-owned manifest is the contract.
. "$BUILD_INPUTS"

mkdir -p "$DIST_DIR"

echo "Building 32-bit Alpine Linux rootfs for v86..."
echo ""

docker run --rm --platform linux/386 \
    --env-file "$BUILD_INPUTS" \
    -v "$DIST_DIR:/output" \
    -v "$OVERLAY_DIR:/overlay:ro" \
    -v "$APK_RUNTIME_LOCK:/expected-apk-runtime.lock:ro" \
    "$ALPINE_IMAGE" sh -c '
    set -eu
    set -o pipefail

    echo "[1/4] Installing packages..."
    apk add --no-cache \
        "bash=$APK_BASH_VERSION" \
        "coreutils=$APK_COREUTILS_VERSION" \
        "diffutils=$APK_DIFFUTILS_VERSION" \
        "findutils=$APK_FINDUTILS_VERSION" \
        "grep=$APK_GREP_VERSION" \
        "sed=$APK_SED_VERSION" \
        "gawk=$APK_GAWK_VERSION" \
        "git=$APK_GIT_VERSION" \
        "make=$APK_MAKE_VERSION" \
        "nano=$APK_NANO_VERSION" \
        "less=$APK_LESS_VERSION" \
        "file=$APK_FILE_VERSION" \
        "tree=$APK_TREE_VERSION" \
        "musl-dev=$APK_MUSL_DEV_VERSION"

    # Alpine package/app-link details can vary; tutorials and tests use the
    # portable command name `awk`, so guarantee it exists when gawk is present.
    if [ -x /usr/bin/gawk ]; then
        ln -sf /usr/bin/gawk /usr/bin/awk
    fi

    # Build TCC (Tiny C Compiler) from source — not in Alpine repos for 386
    echo "    Installing TCC (Tiny C Compiler)..."
    apk add --no-cache "gcc=$APK_GCC_VERSION"
    git clone --no-checkout https://repo.or.cz/tinycc.git /tmp/tcc
    cd /tmp/tcc
    git checkout --detach "$TCC_COMMIT"
    if [ "$(git rev-parse HEAD)" != "$TCC_COMMIT" ]; then
        echo "ERROR: TinyCC checkout does not match pinned commit" >&2
        exit 1
    fi
    ./configure --prefix=/usr \
        --elfinterp=/lib/ld-musl-i386.so.1 \
        --crtprefix=/usr/lib \
        --sysincludepaths=/usr/include \
        --libpaths=/usr/lib \
        --config-bcheck=no
    make -j"$(nproc)"
    make install
    # TCC looks for libtcc1.a in /usr/lib (its libdir), not /usr/lib/tcc
    cp /usr/lib/tcc/libtcc1.a /usr/lib/libtcc1.a
    cp /usr/lib/tcc/runmain.o /usr/lib/runmain.o
    cp /usr/lib/tcc/bt-exe.o /usr/lib/bt-exe.o
    cp /usr/lib/tcc/bt-log.o /usr/lib/bt-log.o
    cd /
    rm -rf /tmp/tcc
    # Remove build-time GCC (huge), keep only TCC
    apk del gcc

    echo "[2/4] Configuring system..."

    # Custom init script (PID 1)
    cp /overlay/init /init
    chmod +x /init

    # Root user: empty password, bash shell
    sed -i "s|^root:.*|root::0:0:root:/root:/bin/bash|" /etc/passwd
    echo "root::0::::::" > /etc/shadow

    # gcc wrapper that delegates to tcc
    cp /overlay/gcc /usr/bin/gcc
    chmod +x /usr/bin/gcc

    # gg-daemon: in-VM RPC server for tutorial-code.js sync queries.
    # See vm/overlay/gg-daemon for protocol details.
    cp /overlay/gg-daemon /usr/local/bin/gg-daemon
    chmod +x /usr/local/bin/gg-daemon

    # Hostname
    echo "tutorial" > /etc/hostname

    # Bash configuration
    cp /overlay/bashrc /root/.bashrc

    # Tutorial mount point
    mkdir -p /tutorial

    # Welcome message
    cat > /etc/motd << "MOTD"
  _____     __            _       __
 |_   _|   / /_ __  _ __ (_) __ _/ /
   | || | | | __/ _ \| __| |/ _` | |
   | || |_| | || (_) | |  | | (_| | |
   |_| \__,_|\__\___/|_|  |_|\__,_|_|

 Interactive Shell Scripting Tutorial
 Your files are in /tutorial
MOTD

    echo "[3/4] Installing kernel & network modules..."
    rm -f /output/.bzImage.new
    apk add --no-cache "linux-virt=$APK_LINUX_VIRT_VERSION"

    awk -F: '\''/^P:/{package_name=$2} /^V:/{print package_name "=" substr($0,3)}'\'' \
        /lib/apk/db/installed | LC_ALL=C sort > /tmp/apk-runtime.actual
    if ! diff -u /expected-apk-runtime.lock /tmp/apk-runtime.actual; then
        echo "ERROR: Installed Alpine package closure differs from vm/apk-runtime.lock" >&2
        echo "Refresh the lock only as part of a reviewed VM dependency update." >&2
        exit 1
    fi
    rm -f /tmp/apk-runtime.actual

    test -s /boot/vmlinuz-virt
    cp /boot/vmlinuz-virt /output/.bzImage.new
    test -s /output/.bzImage.new
    echo "    kernel: $(du -sh /output/.bzImage.new | cut -f1)"

    # Strip unused kernel modules avoiding --parents issue
    mkdir -p /tmp/keep_modules
    cd /
    find lib/modules \( -name "modules.*" -o -name "9p*.ko*" -o -name "virtio*.ko*" -o -name "netfs*.ko*" -o -name "fscache*.ko*" \) | cpio -pdm /tmp/keep_modules/ 2>/dev/null
    cd - >/dev/null

    require_module() {
        module_path="$(find /tmp/keep_modules/lib/modules -type f -name "$1" -print -quit)"
        if [ -z "$module_path" ] || [ ! -s "$module_path" ]; then
            echo "ERROR: Required kernel module metadata/payload is missing: $1" >&2
            exit 1
        fi
    }
    require_module "modules.dep"
    require_module "9p.ko*"
    require_module "9pnet_virtio.ko*"
    require_module "virtio_blk.ko*"
    require_module "virtio_net.ko*"

    rm -rf /lib/modules
    mv /tmp/keep_modules/lib/modules /lib/
    rm -rf /tmp/keep_modules

    echo "[4/4] Creating cpio archive..."

    # Export the full container filesystem as a cpio initrd,
    # excluding Docker mount points and unnecessary directories
    rm -f /output/.rootfs.cpio.gz.new
    cd /
    find . \
        -path ./proc -prune -o \
        -path ./sys -prune -o \
        -path ./dev -prune -o \
        -path ./output -prune -o \
        -path ./overlay -prune -o \
        -path ./expected-apk-runtime.lock -prune -o \
        -path ./var/cache -prune -o \
        -print0 \
    | cpio --null -o --format=newc 2>/dev/null \
    | gzip -9 > /output/.rootfs.cpio.gz.new

    test -s /output/.rootfs.cpio.gz.new
    gzip -t /output/.rootfs.cpio.gz.new

    echo "    rootfs: $(du -sh /output/.rootfs.cpio.gz.new | cut -f1)"

    echo ""
    echo "Build complete!"
'

# Publish the two staged boot artifacts only after the container has produced
# and validated both of them. A failed build therefore leaves the previously
# working pair untouched.
test -s "$DIST_DIR/.bzImage.new"
test -s "$DIST_DIR/.rootfs.cpio.gz.new"
mv "$DIST_DIR/.rootfs.cpio.gz.new" "$DIST_DIR/rootfs.cpio.gz"
mv "$DIST_DIR/.bzImage.new" "$DIST_DIR/bzImage"

# A v86 save-state embeds the kernel, initrd, emulator build, and memory
# configuration. Once either boot artifact changes, the old snapshot is unsafe
# to restore. Force the release workflow to regenerate it instead of silently
# shipping a stale state that bypasses the newly built files.
rm -f \
    "$DIST_DIR/state.bin" \
    "$DIST_DIR/state.bin.gz" \
    "$DIST_DIR/SNAPSHOT_INPUTS" \
    "$DIST_DIR/SHA256SUMS"

echo "Invalidated the previous VM snapshot; regenerate it with make vm-snapshot."

echo ""
echo "Output files:"
ls -lh "$DIST_DIR/"
