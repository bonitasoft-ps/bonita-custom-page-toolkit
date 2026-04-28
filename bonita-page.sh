#!/usr/bin/env bash
# bonita-page — standalone CLI wrapper. Lets clients run the toolkit without
# `npm install -g` or any IA. Just clone the repo and run this script.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Need Node 20+
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required but not installed." >&2
  echo "Install Node.js 20+ from https://nodejs.org/ and try again." >&2
  exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "WARNING: Node.js $NODE_MAJOR detected, this toolkit expects 20+. Continuing anyway..." >&2
fi

# Optional: yauzl for `validate` subcommand. If missing, validate emits a hint.
# Other subcommands (scaffold, wrap, build) have no runtime deps.

exec node "$SCRIPT_DIR/scripts/cli.js" "$@"
