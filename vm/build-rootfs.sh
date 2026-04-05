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
        diffutils \
        findutils \
        grep \
        sed \
        gawk \
        git \
        make \
        nano \
        less \
        file \
        tree \
        musl-dev \
        mandoc \
        man-pages \
        bash-doc \
        coreutils-doc \
        diffutils-doc \
        findutils-doc \
        git-doc \
        grep-doc \
        less-doc \
        nano-doc \
        sed-doc

    # Build TCC (Tiny C Compiler) from source — not in Alpine repos for 386
    echo "    Installing TCC (Tiny C Compiler)..."
    apk add --no-cache gcc 2>&1 | tail -1
    git clone --depth 1 https://repo.or.cz/tinycc.git /tmp/tcc
    cd /tmp/tcc
    ./configure --prefix=/usr \
        --elfinterp=/lib/ld-musl-i386.so.1 \
        --crtprefix=/usr/lib \
        --sysincludepaths=/usr/include \
        --libpaths=/usr/lib \
        --config-bcheck=no
    make -j$(nproc)
    make install
    # TCC looks for libtcc1.a in /usr/lib (its libdir), not /usr/lib/tcc
    cp /usr/lib/tcc/libtcc1.a /usr/lib/libtcc1.a
    cp /usr/lib/tcc/runmain.o /usr/lib/runmain.o
    cp /usr/lib/tcc/bt-exe.o /usr/lib/bt-exe.o
    cp /usr/lib/tcc/bt-log.o /usr/lib/bt-log.o
    cd /
    rm -rf /tmp/tcc
    # Remove build-time GCC (huge), keep only TCC
    apk del gcc 2>&1 | tail -1

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

    # Hostname
    echo "tutorial" > /etc/hostname

    # Bash configuration
    cp /overlay/bashrc /root/.bashrc

    # Wrap man to always pipe output through cat.
    # When man sees stdout is a pipe (not a TTY), it skips the internal pager
    # fork entirely and just writes directly — avoiding the hang in v86.
    printf "#!/bin/sh\n/usr/bin/man \"\$@\" | cat\n" > /usr/local/bin/man
    chmod +x /usr/local/bin/man

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
