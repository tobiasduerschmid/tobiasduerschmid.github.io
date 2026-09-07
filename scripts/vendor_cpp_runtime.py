#!/usr/bin/env python3
"""Vendor the pinned npm archives supplied as arguments (no install scripts).

Usage: python3 scripts/vendor_cpp_runtime.py CLANG.tgz WASI_SHIM.tgz LICENSE_DIRECTORY
Obtain the archives with npm pack --ignore-scripts for the versions below.
Fetch the notice files listed in cpp-runtime-license-sources.json into the
license directory, preserving the listed names. Source/member/first_lines
fields describe how each notice is obtained; every notice is hash-checked.
"""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1] / 'js/vendor'
CLANG_VERSION = '22.0.0-git20542-10'
WASI_VERSION = '0.4.2'
INTEGRITIES = [
    'V31/z9GrJECKeACTDUyvg2llbEUiFi3bxtL5HSg7H/6sydSxdI/AoVAD9F5ozrfLjotWl0B9rghR87m+DUM/zg==',
    '/iHkCVUG3VbcbmEHn5iIUpIrh7a7WPiwZ3sHy4HZKZzBdSadwdddYDZAII2zBvQYV0Lfi8naZngPCN7WPHI/hA==',
]

# The upstream loader is unchanged except for fetching gzip assets. Explicit
# decompression makes download size independent of a static host's HTTP config.
GZIP_LOADER = '''var fetch_default = async function(input, options) {
  const url = new URL(input);
  if (!/\\/(llvm\\.core[0-9]*\\.wasm|llvm-resources\\.tar)$/.test(url.pathname)) {
    return fetch2(input, options);
  }
  const response = await fetch2(new URL(url.href + ".gz"), options);
  if (!response.ok) throw new Error("C++ compiler asset could not be loaded: " + response.status);
  const body = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(body, { headers: {
    "content-type": url.pathname.endsWith(".wasm") ? "application/wasm" : "application/octet-stream"
  }});
};'''


def vendor(archive_path, expected, destination, compiler=False):
    archive_path = Path(archive_path)
    actual = base64.b64encode(hashlib.sha512(archive_path.read_bytes()).digest()).decode()
    if actual != expected:
        raise ValueError(f'{archive_path.name}: npm integrity mismatch')
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, 'r:gz') as archive:
        for entry in archive.getmembers():
            if not entry.isfile():
                continue
            name = entry.name.removeprefix('package/')
            allowed = name.startswith('gen/' if compiler else 'dist/') or name in (
                'README.md', 'package.json', 'LICENSE-APACHE', 'LICENSE-MIT')
            if not allowed:
                continue
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError(f'Unsafe archive path: {name}')
            data = archive.extractfile(entry).read()
            if compiler and name == 'gen/bundle.js':
                source = data.decode()
                if source.count('var fetch_default = fetch2;') != 1:
                    raise ValueError('Upstream asset loader changed; review the gzip patch')
                data = source.replace('var fetch_default = fetch2;', GZIP_LOADER).encode()
            if compiler and relative.suffix in ('.wasm', '.tar'):
                relative = Path(str(relative) + '.gz')
                data = gzip.compress(data, compresslevel=9, mtime=0)
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)


def manifest(directory):
    entries = []
    for file in sorted(directory.rglob('*')):
        if file.is_file() and file.name != 'SHA256SUMS':
            entries.append(f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(directory)}')
    (directory / 'SHA256SUMS').write_text('\n'.join(entries) + '\n')


def vendor_notices(source_directory, destination):
    source_manifest = Path(__file__).with_name('cpp-runtime-license-sources.json')
    notices = json.loads(source_manifest.read_text())
    verified = {}
    for name, metadata in notices.items():
        data = (Path(source_directory) / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != metadata['sha256']:
            raise ValueError(f'{name}: upstream notice integrity mismatch')
        verified[name] = data
    license_directory = destination / 'licenses'
    license_directory.mkdir(parents=True, exist_ok=True)
    for name, data in verified.items():
        (license_directory / name).write_bytes(data)
    (license_directory / 'SOURCES.json').write_bytes(source_manifest.read_bytes())
    (destination / 'LICENSE.txt').write_bytes(verified['YoWASP-Clang.txt'])


if __name__ == '__main__':
    clang_archive, wasi_archive, license_directory = sys.argv[1:]
    clang_dir = ROOT / 'yowasp-clang' / CLANG_VERSION
    wasi_dir = ROOT / 'browser-wasi-shim' / WASI_VERSION
    vendor(clang_archive, INTEGRITIES[0], clang_dir, compiler=True)
    vendor(wasi_archive, INTEGRITIES[1], wasi_dir)
    vendor_notices(license_directory, clang_dir)
    (clang_dir / 'SEBOOK-NOTICE.md').write_text(
        '# Browser C++ compiler\n\n'
        f'Upstream: @yowasp/clang {CLANG_VERSION}, https://github.com/YoWASP/clang.\n'
        'The package bundles LLVM/Clang/LLD, WASI C/C++ headers and libraries, '
        '@yowasp/runtime 11.0.67 (including nanotar), and generated Bytecode Alliance component bindings.\n'
        'The licenses directory preserves their notices, including LLVM, WASI libc '
        'and its embedded third-party components. licenses/SOURCES.json records '
        'notice origins and hashes. The package README specifies Apache 2.0 for '
        'YoWASP Clang, although its package.json reports ISC; both the original '
        'metadata and upstream LICENSE.txt are retained.\n\n'
        'Local change: gzip binary resources and adapt only their fetch loader '
        'to decompress them. The compiler binaries are unmodified. '
        'Reproduce with scripts/vendor_cpp_runtime.py; npm archive SHA-512 '
        'integrities are pinned there. SHA256SUMS covers the served files.\n\n'
        'The compiler runs inside a disposable browser worker. Student source '
        'is compiled locally; it is never submitted to a remote compiler. '
        'No VM, Service Worker, application cache, or cross-origin isolation is required. '
        'The bundled WASI libc++ omits exception support, so the worker compiles '
        'with -fno-exceptions. Source files and executions stay in memory.\n'
    )
    manifest(clang_dir)
    manifest(wasi_dir)
