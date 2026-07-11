#!/usr/bin/env bash
# docs-use doctor — Tier 1 structural lint (deterministic, high-confidence).
#
# Usage: docs-lint.sh [path ...]
#   path: ディレクトリ or *.md。省略時は repo 内の docs ディレクトリを
#         auto-discover する (node_modules / .git / .terragrunt-cache* / tmp を除外)。
#
# docs-use 規則のうち機械的に検出できる違反のみを報告する。
# 意味的監査 (MECHANISM-DUP / STALE / MIS-LAYERED など) は references/doctor.md の
# Tier 2 手順に従い、コードと突合して人手 (または subagent) で行う。
#
# exit code: 違反が 1 件でもあれば 1、無ければ 0。
set -uo pipefail

# ---- scope 解決 -------------------------------------------------------------
roots=()
if [ "$#" -gt 0 ]; then
  roots=("$@")
else
  while IFS= read -r d; do roots+=("$d"); done < <(
    find . -type d -name docs \
      -not -path '*/node_modules/*' -not -path '*/.git/*' \
      -not -path '*/.terragrunt-cache*/*' -not -path '*/tmp/*' 2>/dev/null
  )
fi

files=()
for r in "${roots[@]}"; do
  if [ -f "$r" ]; then
    files+=("$r")
  elif [ -d "$r" ]; then
    while IFS= read -r f; do files+=("$f"); done < <(find "$r" -type f -name '*.md' 2>/dev/null)
  fi
done
if [ "${#files[@]}" -eq 0 ]; then echo "対象 *.md が見つかりません: ${roots[*]:-<auto>}"; exit 0; fi

# trace 解決用の「定義済み name」の宇宙は scope に依らず repo 全体の docs から集める。
# scope を絞ったとき cross-layer 参照 (internal-design → requirements 等) を
# false-positive で dangling 扱いしないため。
allfiles=()
while IFS= read -r f; do allfiles+=("$f"); done < <(
  find . -type f -name '*.md' -path '*/docs/*' \
    -not -path '*/node_modules/*' -not -path '*/.git/*' \
    -not -path '*/.terragrunt-cache*/*' -not -path '*/tmp/*' 2>/dev/null
)
[ "${#allfiles[@]}" -eq 0 ] && allfiles=("${files[@]}")

fail=0
hits() { # 標準入力に行があれば表示し fail=1。無ければ OK。
  local out; out="$(cat)"
  if [ -n "$out" ]; then printf '%s\n' "$out" | sed 's/^/  /'; fail=1; else echo "  OK"; fi
}

echo "scope: ${#files[@]} files"

echo; echo "=== [topic] opening tag に status= が無い ==="
grep -nHE '<(raw_rfp|rfp|requirements|internal_design)[ >]' "${files[@]}" 2>/dev/null \
  | grep -vE 'status=' | hits

echo; echo "=== [topic] opening tag に name= が無い ==="
grep -nHE '<(raw_rfp|rfp|requirements|internal_design) ' "${files[@]}" 2>/dev/null \
  | grep -E 'status=' | grep -vE 'name=' | hits

echo; echo "=== [topic] status=\"superseded\" に superseded-by= が無い ==="
grep -nHE '<[a-z_]+[^>]*status="superseded"' "${files[@]}" 2>/dev/null \
  | grep -vE 'superseded-by=' | hits

echo; echo "=== [human] <human> に ts= が無い ==="
grep -nHE '<human( |>)' "${files[@]}" 2>/dev/null | grep -vE 'ts=' | hits

echo; echo "=== [legacy] <unrealized> 記法が残存 (topic 記法へ移行が必要) ==="
grep -nHE '<unrealized>' "${files[@]}" 2>/dev/null | hits

echo; echo "=== [link] git 非管理パス (tmp/) への参照 ==="
grep -nHE '\]\((\.\.?/)*tmp/' "${files[@]}" 2>/dev/null | hits

echo; echo "=== [link] 解決しない相対 .md / ファイルリンク ==="
{
  for f in "${files[@]}"; do
    d=$(dirname "$f")
    grep -oE '\]\(\.\.?/[^)]+\)' "$f" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//' | while IFS= read -r link; do
      target="${link%%#*}"
      [ -z "$target" ] && continue
      [ -e "$d/$target" ] || echo "$f -> $link"
    done
  done
} | hits

echo; echo "=== [trace] 参照されているが定義の無い topic name (rfps/raw-rfps/requirements/superseded-by。定義は repo 全体から解決) ==="
defined=$(grep -rhoE 'name="[^"]+"' "${allfiles[@]}" 2>/dev/null | sed -E 's/name="([^"]+)"/\1/' | sort -u)
referenced=$(grep -rhoE '(raw-rfps|rfps|requirements|superseded-by)="[^"]+"' "${files[@]}" 2>/dev/null \
  | sed -E 's/^[a-z-]+="([^"]+)"/\1/' | tr ',' '\n' | sed 's/[[:space:]]//g' | grep -v '^$' | sort -u)
comm -23 <(printf '%s\n' "$referenced") <(printf '%s\n' "$defined") | hits

echo; echo "=== [hygiene] docs ツリー内の .DS_Store (git 管理外でも掃除推奨) ==="
{ for r in "${roots[@]}"; do [ -d "$r" ] && find "$r" -name .DS_Store 2>/dev/null; done; } | hits

echo
if [ "$fail" -ne 0 ]; then
  echo "Tier 1 違反あり。意味的監査 (Tier 2) は references/doctor.md に従う。"
  exit 1
else
  echo "Tier 1 はクリーン。意味的監査 (Tier 2: 機構転記/腐敗/レイヤ誤り) は references/doctor.md に従う。"
  exit 0
fi
