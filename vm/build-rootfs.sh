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

    echo "[1/5] Installing packages..."
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
        tree \
        musl-dev \
        gdb

    # Alpine package/app-link details can vary; tutorials and tests use the
    # portable command name `awk`, so guarantee it exists when gawk is present.
    if [ -x /usr/bin/gawk ]; then
        ln -sf /usr/bin/gawk /usr/bin/awk
    fi

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

    echo "[2/5] Configuring system..."

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

    # tutorial-gdb: in-VM wrapper that launches gdb in MI3 mode for the
    # JS-side time-travel debugger UI. Used by tutorials with `debugger: gdb`.
    cp /overlay/tutorial-gdb /usr/local/bin/tutorial-gdb
    chmod +x /usr/local/bin/tutorial-gdb

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

    echo "[3/5] Installing kernel & network modules..."
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

    echo "[4/5] Slimming image (removing gdb incidental bloat)..."
    # Adding the gdb package grew the compressed initramfs by ~21 MB.
    # Most of that delta is bundled-but-unused infrastructure, not gdb
    # itself. We remove it here:
    #
    #   - musl-dbg (~2.6 MB)   : debug info for musl libc. We step user
    #                            code only, never into libc, so the
    #                            symbols are dead weight.
    #   - python3 stdlib       : gdb links libpython3.11.so so an embedded
    #                            interpreter can run pretty-printers. We
    #                            launch gdb with `set auto-load
    #                            python-scripts off` (see overlay/tutorial-gdb)
    #                            so it never sources any .py file — the
    #                            stdlib + pyc cache (~40 MB uncompressed)
    #                            is removed below. libpython.so itself
    #                            stays because gdb ELF lists it as NEEDED;
    #                            dropping it would require rebuilding gdb
    #                            from source with --without-python.
    #   - libmagic + magic.mgc : ~8.6 MB. The file(1) magic database. No
    #                            tutorial calls file.
    #   - /usr/lib/libc.a      : 6.4 MB static archive. TCC dynamic-links
    #                            by default; no tutorial uses -static.
    #   - /usr/lib/debug/      : 2.5 MB detached debug symbols for system
    #                            binaries. Unused without the matching
    #                            .gnu_debuglink workflow.
    #   - gdbserver / gcore / gdb-add-index : never used (we never
    #                            remote-debug, generate cores, or pre-index
    #                            DWARF).
    #
    # Result: rebuild shrinks back close to the pre-gdb baseline.
    apk del --no-scripts musl-dbg file libmagic 2>&1 | tail -1 || true
    rm -rf /usr/lib/debug
    rm -f  /usr/lib/libc.a
    rm -rf /usr/share/doc /usr/share/man /usr/share/info /usr/share/locale
    rm -f  /usr/bin/gdbserver /usr/bin/gcore /usr/bin/gdb-add-index
    # gdb data files: keep syscalls/ (needed for `catch syscall`); drop the
    # Python pretty-printer module + the vendor-specific system-gdbinit
    # scripts (elinos / wrs-linux). Without these, gdb has nothing to load
    # via its internal Python module, so it never touches libpython.
    rm -rf /usr/share/gdb/python
    rm -rf /usr/share/gdb/system-gdbinit
    # Python: drop the entire stdlib + pyc cache. gdb only opens it when
    # auto-load python-scripts is on, which tutorial-gdb disables. If a
    # future tutorial needs gdb pretty-printers, revert this block and
    # re-enable auto-load.
    rm -rf /usr/lib/python3.11/__pycache__
    rm -rf /usr/lib/python3.11/ensurepip
    rm -rf /usr/lib/python3.11/distutils
    rm -rf /usr/lib/python3.11/lib2to3
    rm -rf /usr/lib/python3.11/pydoc_data
    rm -rf /usr/lib/python3.11/idlelib
    rm -rf /usr/lib/python3.11/turtledemo
    rm -rf /usr/lib/python3.11/tkinter
    rm -rf /usr/lib/python3.11/test
    find  /usr/lib/python3.11 -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    # Strip gdb. --strip-all is safe: gdb does not need its own symbol
    # table — only the inferior symbols (loaded from the user binary at
    # runtime) matter.
    strip --strip-all /usr/bin/gdb 2>/dev/null || true
    echo "    /usr/bin/gdb after strip: $(du -sh /usr/bin/gdb | cut -f1)"

    echo "[5/5] Creating cpio archive..."

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
