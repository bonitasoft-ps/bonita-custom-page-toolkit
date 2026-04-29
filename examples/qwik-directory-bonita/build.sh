#!/usr/bin/env bash
# build.sh — install + build + docs helper for the Bonita custom page (Qwik)
#
# Usage:
#   ./build.sh            # everything: npm install + ZIP + docs in dist/
#   ./build.sh install    # only npm install
#   ./build.sh build      # only the ZIP (no install)
#   ./build.sh dist       # only the ZIP + docs (no install)

set -e

cd "$(dirname "$0")"

cmd="${1:-all}"

run_install() {
  echo "==> npm install"
  npm install
}

run_build() {
  echo "==> npm run build:bonita"
  npm run build:bonita
}

run_dist() {
  echo "==> npm run dist (ZIP + docs)"
  npm run dist
}

print_outputs() {
  echo
  echo "Output:"
  ls -lh dist/page-appDirectoryBonitaQwikHome.zip 2>/dev/null && echo "  └─ upload this ZIP to Bonita resource-list"
  ls -lh dist/DEPLOY-README.md dist/DEPLOY-README.html 2>/dev/null && echo "  └─ deployment guides (multilingual)"
}

case "$cmd" in
  all)
    run_install
    run_dist
    print_outputs
    ;;
  install)
    run_install
    ;;
  build)
    run_build
    print_outputs
    ;;
  dist)
    run_dist
    print_outputs
    ;;
  -h|--help|help)
    echo "Usage: $0 [install|build|dist]"
    echo "  no arg   install + ZIP + docs"
    echo "  install  only npm install"
    echo "  build    only the ZIP"
    echo "  dist     ZIP + docs (no install)"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: $0 [install|build|dist]" >&2
    exit 1
    ;;
esac
