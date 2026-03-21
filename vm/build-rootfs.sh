#!/bin/bash
# build-rootfs.sh - Build Alpine Linux rootfs and extract kernel for v86
# Requires: Docker
#
# Installs packages directly into an Alpine container, then exports the
# entire filesystem as a cpio initrd. This ensures all shared libraries
# and dependencies are properly resolved.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
OVERLAY_DIR="$SCRIPT_DIR/overlay"

mkdir -p "$DIST_DIR"

echo "Building 32-bit Alpine Linux rootfs for v86..."
echo ""

docker run --rm --platform linux/386 \
    -v "$DIST_DIR:/output" \
    -v "$OVERLAY_DIR:/overlay:ro" \
    alpine:3.19 sh -c '
    set -e

    echo "[1/4] Installing packages..."
    apk add --no-cache \
        bash \
        coreutils \
        findutils \
        grep \
        sed \
        gawk \
        git \
        make \
        nano \
        less \
        file \
        tree

    echo "[2/4] Configuring system..."

    # Custom init script (PID 1)
    cp /overlay/init /init
    chmod +x /init

    # Root user: empty password, bash shell
    sed -i "s|^root:.*|root::0:0:root:/root:/bin/bash|" /etc/passwd
    echo "root::0::::::" > /etc/shadow

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
    apk add --no-cache linux-virt 2>/dev/null || true
    if [ -f /boot/vmlinuz-virt ]; then
        cp /boot/vmlinuz-virt /output/bzImage
        echo "    kernel: $(du -sh /output/bzImage | cut -f1)"
    else
        echo "    WARNING: linux-virt not available. Provide a kernel at vm/dist/bzImage"
    fi

    # Strip unused kernel modules avoiding --parents issue
    mkdir -p /tmp/keep_modules
    cd /
    find lib/modules \( -name "modules.*" -o -name "9p*.ko*" -o -name "virtio*.ko*" -o -name "netfs*.ko*" -o -name "fscache*.ko*" \) | cpio -pdm /tmp/keep_modules/ 2>/dev/null || true
    cd - >/dev/null
    
    rm -rf /lib/modules
    if [ -d /tmp/keep_modules/lib/modules ]; then
        mv /tmp/keep_modules/lib/modules /lib/
    fi
    rm -rf /tmp/keep_modules

    echo "[4/4] Creating cpio archive..."

    # Export the full container filesystem as a cpio initrd,
    # excluding Docker mount points and unnecessary directories
    cd /
    find . \
        -path ./proc -prune -o \
        -path ./sys -prune -o \
        -path ./dev -prune -o \
        -path ./output -prune -o \
        -path ./overlay -prune -o \
        -path ./var/cache -prune -o \
        -print0 \
    | cpio --null -o --format=newc 2>/dev/null \
    | gzip -9 > /output/rootfs.cpio.gz

    echo "    rootfs: $(du -sh /output/rootfs.cpio.gz | cut -f1)"

    echo ""
    echo "Build complete!"
'

echo ""
echo "Output files:"
ls -lh "$DIST_DIR/"
