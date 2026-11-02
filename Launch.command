#!/bin/zsh
cd -- "${0:A:h}"
runtime_node="$(command -v node 2>/dev/null)"
if [[ -z "$runtime_node" ]]; then
  runtime_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$runtime_node" ]]; then
  print "Install Node.js 20 or newer, then run npm start in this folder."
  read -k 1 "?Press any key to close."
  exit 1
fi
exec "$runtime_node" server.mjs
