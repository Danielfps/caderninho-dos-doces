#!/usr/bin/env bash
# Atualiza o grafo do Graphify em graphify-out/.
#
# O Graphify não lê JavaScript dentro de HTML, e quase todo o app está no <script>
# de app/index.html. Por isso o grafo é montado numa cópia temporária do projeto,
# onde esse script vira app/index.html.js (com as mesmas linhas do index.html), e o
# resultado volta para graphify-out/ apontando para app/index.html.
#
# Uso: scripts/graphify.sh            -> instala o graphify se faltar e refaz o grafo
#      scripts/graphify.sh --hook     -> (hook PostToolUse) só refaz se o arquivo editado for do projeto
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
VERSAO_GRAPHIFY="0.9.97"

if [[ "${1:-}" == "--hook" ]]; then
  arquivo="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
  case "$arquivo" in
    "$RAIZ"/graphify-out/*|"") exit 0 ;;
    "$RAIZ"/*) ;;
    *) exit 0 ;;
  esac
fi

if ! command -v graphify >/dev/null 2>&1; then
  pip install -q "graphifyy==$VERSAO_GRAPHIFY" >/dev/null 2>&1 || { echo "graphify: não consegui instalar" >&2; exit 0; }
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Copia o estado atual dos arquivos (inclusive o que ainda não foi para o commit).
cd "$RAIZ"
git ls-files -co --exclude-standard -z | grep -zv '^graphify-out/' | xargs -0 cp --parents -t "$TMP" 2>/dev/null || true

python3 - "$TMP/app/index.html" <<'PY'
import re, sys, pathlib
html = pathlib.Path(sys.argv[1])
if html.exists():
    texto = html.read_text()
    # mantém só o conteúdo dos <script>, trocando o resto por linhas vazias
    js = re.sub(r'(?s)(^|</script>).*?(<script[^>]*>|$)',
                lambda m: '\n' * m.group(0).count('\n'), texto)
    html.with_name('index.html.js').write_text(js)
PY

[[ -d "$RAIZ/graphify-out/cache" ]] && mkdir -p "$TMP/graphify-out" && cp -r "$RAIZ/graphify-out/cache" "$TMP/graphify-out/"
(cd "$TMP" && GRAPHIFY_FORCE=1 graphify update . >/dev/null 2>&1) || { echo "graphify: falhou ao montar o grafo" >&2; exit 0; }

# Traz o resultado de volta, sem caminhos da pasta temporária.
mkdir -p "$RAIZ/graphify-out"
for f in graph.json graph.html GRAPH_REPORT.md manifest.json; do
  [[ -f "$TMP/graphify-out/$f" ]] || continue
  sed -e "s#$TMP/##g" -e "s#$TMP#.#g" -e 's#app/index\.html\.js#app/index.html#g' -e 's#index\.html\.js#index.html#g' \
      -e "s#^\# Graph Report - $(basename "$TMP") #\# Graph Report - caderninho-dos-doces #" \
      "$TMP/graphify-out/$f" > "$RAIZ/graphify-out/$f"
done
rm -rf "$RAIZ/graphify-out/cache" && cp -r "$TMP/graphify-out/cache" "$RAIZ/graphify-out/" 2>/dev/null || true
echo "graphify: grafo atualizado em graphify-out/ ($(grep -m1 -o '[0-9]* nodes · [0-9]* edges' graphify-out/GRAPH_REPORT.md))"
