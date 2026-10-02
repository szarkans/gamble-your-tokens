#!/usr/bin/env python3
"""Чистые input+output токены за сегодня (локальные сутки) по каждому харнессу, найденному на машине.
Прототип. Рецепты — docs/map/research/01-token-sources.md. Печатает JSON:
{"sources": [{"id", "name", "tokens"}, ...], "total": N}. Харнесса нет на машине — его нет в списке."""
import glob, json, os, sqlite3
from datetime import datetime
from pathlib import Path

H = os.path.expanduser("~")
env = os.environ.get
# Where each harness keeps its logs; every harness honors its own env override.
CLAUDE_DIR = env("CLAUDE_CONFIG_DIR") or os.path.join(H, ".claude")
CODEX_DIR = env("CODEX_HOME") or os.path.join(H, ".codex")
midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
t0 = midnight.timestamp()

def today(ts):  # ISO 'Z' -> epoch
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() >= t0

def claude():
    last = {}  # (msg id, requestId) -> usage; последняя строка побеждает
    for f in glob.glob(f"{glob.escape(CLAUDE_DIR)}/projects/**/*.jsonl", recursive=True):
        if os.path.getmtime(f) < t0:
            continue
        for line in open(f, errors="ignore"):
            if '"assistant"' not in line or '"usage"' not in line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            m = d.get("message") or {}
            u = m.get("usage")
            if d.get("type") != "assistant" or not u or not today(d.get("timestamp", "1970-01-01T00:00:00Z")):
                continue
            last[(m.get("id"), d.get("requestId"))] = u
    # У Anthropic новый вход хода лежит в cache_creation (Claude Code кэширует всё новое), а input_tokens —
    # только хвост после точки кэша. Новое = input + cache_creation; cache_read (перечитанное) не считаем.
    return sum((u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) + (u.get("output_tokens") or 0)
               for u in last.values())

# WSL hack: inside WSL also count the Windows-side Codex (desktop app / native CLI), which logs to
# C:\Users\<name>\.codex. On other systems /mnt/c doesn't exist and the glob is empty.
CODEX_ROOTS = list({os.path.realpath(r): r for r in [CODEX_DIR] + glob.glob("/mnt/c/Users/*/.codex")}.values())  # CODEX_HOME may point at /mnt/c too

def codex():
    total = 0
    files = [f for root in CODEX_ROOTS for f in glob.glob(f"{glob.escape(root)}/sessions/**/*.jsonl", recursive=True)]
    for f in files:
        if os.path.getmtime(f) < t0:
            continue
        prev = 0  # счётчик накопительный; события до полуночи двигают базу, но не считаются
        for line in open(f, errors="ignore"):
            if '"token_count"' not in line:
                continue
            try:
                d = json.loads(line)
                u = d["payload"]["info"]["total_token_usage"]
            except (ValueError, KeyError, TypeError):
                continue
            cur = u["input_tokens"] - u.get("cached_input_tokens", 0) + u["output_tokens"]
            if cur > prev:
                if today(d["timestamp"]):
                    total += cur - prev
                prev = cur
    return total

# OpenCode uses xdg-basedir on every OS (no AppData / Library on Windows and macOS):
# $XDG_DATA_HOME/opencode/opencode.db, default ~/.local/share/opencode/opencode.db.
# OPENCODE_DB overrides the file (absolute, or relative to that data dir).
OPENCODE_DATA = os.path.join(env("XDG_DATA_HOME") or os.path.join(H, ".local", "share"), "opencode")
OPENCODE_DB = os.path.join(OPENCODE_DATA, env("OPENCODE_DB") or "opencode.db")

def opencode():
    con = sqlite3.connect(Path(OPENCODE_DB).resolve().as_uri() + "?mode=ro", uri=True)
    total = 0
    for (data,) in con.execute("select data from message where time_created >= ?", (int(t0 * 1000),)):
        d = json.loads(data)
        t = d.get("tokens") or {}
        if d.get("role") == "assistant":
            total += t.get("input", 0) + (t.get("cache") or {}).get("write", 0) + t.get("output", 0) + t.get("reasoning", 0)
    return total

# Реестр: новый харнесс = одна строка (id, имя, признак наличия, счётчик).
SOURCES = [
    ("claude", "Claude Code", [os.path.join(CLAUDE_DIR, "projects")], claude),
    ("codex", "Codex", [os.path.join(r, "sessions") for r in CODEX_ROOTS], codex),
    ("opencode", "OpenCode", [OPENCODE_DB], opencode),
]

if __name__ == "__main__":
    out = []
    for sid, name, markers, count in SOURCES:
        if any(os.path.exists(m) for m in markers):
            try:
                out.append({"id": sid, "name": name, "tokens": count()})
            except Exception as e:  # сломанный формат одного харнесса не роняет остальные
                out.append({"id": sid, "name": name, "tokens": 0, "error": type(e).__name__})
    out.sort(key=lambda s: -s["tokens"])
    print(json.dumps({"sources": out, "total": sum(s["tokens"] for s in out)}, ensure_ascii=False))
