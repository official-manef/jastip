#!/bin/sh
# Convex's prebuilt backend needs glibc 2.38+. This sandbox has 2.36, so the
# CLI binary is wrapped with Ubuntu 24.04's loader. Idempotent.
set -eu
cd /workspace

ROOT=/workspace/.cache/convex-sysroot
LD="$ROOT/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2"
LIB="$ROOT/usr/lib/x86_64-linux-gnu"

if [ ! -x "$LD" ]; then
  mkdir -p "$ROOT" /tmp/debs
  base=http://archive.ubuntu.com/ubuntu
  for f in \
    pool/main/g/glibc/libc6_2.39-0ubuntu8.9_amd64.deb \
    pool/main/g/gcc-14/libgcc-s1_14.2.0-4ubuntu2~24.04.1_amd64.deb \
    pool/main/g/gcc-14/libstdc++6_14.2.0-4ubuntu2~24.04.1_amd64.deb
  do
    name=$(basename "$f")
    if [ ! -f "/tmp/debs/$name" ]; then
      curl -fsSL -o "/tmp/debs/$name" "$base/$f"
    fi
    dpkg-deb -x "/tmp/debs/$name" "$ROOT"
  done
fi

VER=$(node -e '
fetch("https://version.convex.dev/v1/local_backend_version", { headers: { "Convex-Client": "npm-cli-1.46.0" } })
  .then((r) => r.json())
  .then((j) => { if (!j.version) process.exit(1); process.stdout.write(j.version); })
  .catch(() => process.exit(1));
')

CACHE="${HOME}/.cache/convex/binaries/${VER}"
BIN="$CACHE/convex-local-backend"
REAL="$CACHE/convex-local-backend.real"
mkdir -p "$CACHE"

is_elf() {
  [ -f "$1" ] && python3 -c "import sys; b=open(sys.argv[1],'rb').read(4); sys.exit(0 if b==b'\\x7fELF' else 1)" "$1"
}

if [ ! -f "$REAL" ]; then
  if is_elf "$BIN"; then
    mv "$BIN" "$REAL"
  else
    zip=/tmp/convex-local-backend.zip
    curl -fsSL -o "$zip" \
      "https://github.com/get-convex/convex-backend/releases/download/${VER}/convex-local-backend-x86_64-unknown-linux-gnu.zip"
    python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extract('convex-local-backend', sys.argv[2])" "$zip" "$CACHE"
    mv "$BIN" "$REAL"
  fi
  chmod +x "$REAL"
fi

cat > "$BIN" << EOF
#!/bin/sh
exec "$LD" --library-path "$LIB" "$REAL" "\$@"
EOF
chmod +x "$BIN"
"$BIN" --help >/dev/null
echo "convex backend ${VER} ready"
