#!/usr/bin/env python3
"""token-gamble local server. Stdlib only.

GET  /state  — today's token sources, casino day state, records, config.
POST /round  — result of one round {game, bet, back, label}; updates the day and history.
Everything else is static files from web/.

Day history: ~/.local/share/token-gamble/history.json
Config:      ~/.config/token-gamble/config.json
--idle N: exit after N seconds without requests (tab closed — polling stopped).
"""
import argparse
import http.server
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share")), "token-gamble")
HISTORY = os.path.join(DATA, "history.json")
CONFIG = os.path.join(os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config")), "token-gamble", "config.json")
DEFAULT_CONFIG = {"title_balance": True}  # баланс в заголовке вкладки — пассивный показ, можно выключить

lock = threading.Lock()
last_hit = time.monotonic()


def today():
    return datetime.now().strftime("%Y-%m-%d")


def yesterday():
    return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")


def load_history():
    try:
        with open(HISTORY, encoding="utf-8") as f:
            h = json.load(f)
        if isinstance(h, dict) and isinstance(h.get("days"), dict):
            return h
    except FileNotFoundError:
        return {"days": {}}
    except ValueError:
        pass
    # битый файл не затираем первым же ходом — откладываем в сторону
    os.replace(HISTORY, f"{HISTORY}.broken-{int(time.time())}")
    return {"days": {}}


def save_history(h):
    os.makedirs(DATA, exist_ok=True)
    tmp = HISTORY + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(h, f, ensure_ascii=False, indent=1)
    os.replace(tmp, HISTORY)  # атомарно: оборванная запись не съест историю


def new_day():
    return {"earned": 0, "net": 0, "rounds": 0, "wagered": 0, "won_rounds": 0,
            "best": None, "worst": None, "broke": 0, "by_game": {}}


def load_config():
    try:
        with open(CONFIG, encoding="utf-8") as f:
            c = json.load(f)
        return {**DEFAULT_CONFIG, **c} if isinstance(c, dict) else dict(DEFAULT_CONFIG)
    except (OSError, ValueError):
        return dict(DEFAULT_CONFIG)


def records(h):
    """Рекорды считаются из истории дней, отдельно не хранятся."""
    days = h["days"]
    r = {"days_played": 0, "best_win": None, "worst_loss": None, "best_day": None, "worst_day": None,
         "most_earned": None, "lifetime_lost": 0, "lifetime_won": 0, "rounds": 0, "broke": 0}
    for date, d in days.items():
        if not d.get("rounds"):
            continue
        r["days_played"] += 1
        r["rounds"] += d["rounds"]
        r["broke"] += d.get("broke", 0)
        if d["net"] < 0:
            r["lifetime_lost"] += -d["net"]
        else:
            r["lifetime_won"] += d["net"]
        b, w = d.get("best"), d.get("worst")
        if b and (r["best_win"] is None or b["profit"] > r["best_win"]["profit"]):
            r["best_win"] = {**b, "date": date}
        if w and (r["worst_loss"] is None or w["profit"] < r["worst_loss"]["profit"]):
            r["worst_loss"] = {**w, "date": date}
        if r["best_day"] is None or d["net"] > r["best_day"]["net"]:
            r["best_day"] = {"date": date, "net": d["net"]}
        if r["worst_day"] is None or d["net"] < r["worst_day"]["net"]:
            r["worst_day"] = {"date": date, "net": d["net"]}
        if r["most_earned"] is None or d.get("earned", 0) > r["most_earned"]["earned"]:
            r["most_earned"] = {"date": date, "earned": d.get("earned", 0)}
    return r


def count_tokens():
    out = subprocess.run([sys.executable, os.path.join(HERE, "count_today.py")],
                         capture_output=True, timeout=30, check=True).stdout
    return json.loads(out)


def apply_round(day, body, earned_total):
    game = str(body.get("game", "?"))[:20]
    bet = int(body["bet"])
    back = int(body["back"])
    if bet <= 0 or back < 0:
        raise ValueError("bet/back")
    profit = back - bet
    day["earned"] = max(day["earned"], earned_total)
    day["net"] += profit
    day["rounds"] += 1
    day["wagered"] += bet
    if profit > 0:
        day["won_rounds"] += 1
    label = str(body.get("label", ""))[:60]
    shot = {"game": game, "profit": profit, "bet": bet, "label": label, "at": datetime.now().strftime("%H:%M")}
    if profit > 0 and (day["best"] is None or profit > day["best"]["profit"]):
        day["best"] = shot
    if profit < 0 and (day["worst"] is None or profit < day["worst"]["profit"]):
        day["worst"] = shot
    if day["earned"] + day["net"] < 1000:  # ниже минимальной ставки — банкрот
        day["broke"] += 1
    g = day["by_game"].setdefault(game, {"rounds": 0, "net": 0})
    g["rounds"] += 1
    g["net"] += profit


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=os.path.join(HERE, "web"), **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # прототип правится на лету
        super().end_headers()

    def send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(data)

    def state(self, tokens=None):
        tokens = tokens or count_tokens()
        with lock:
            h = load_history()
            day = h["days"].get(today()) or new_day()
            if tokens["total"] > day["earned"] and day["rounds"]:
                day["earned"] = tokens["total"]
                h["days"][today()] = day
                save_history(h)
            return {**tokens, "date": today(), "today": day, "records": records(h), "config": load_config()}

    def foreign(self):
        """Чужой Host — DNS rebinding: страница из интернета под именем, указывающим на 127.0.0.1."""
        port = self.server.server_address[1]
        if self.headers.get("Host") in (f"localhost:{port}", f"127.0.0.1:{port}"):
            return False
        self.send_json({"error": "host"}, 403)
        return True

    def do_GET(self):
        global last_hit
        last_hit = time.monotonic()
        if self.foreign():
            return
        path = self.path.split("?")[0]
        if path == "/state":
            try:
                return self.send_json(self.state())
            except (subprocess.SubprocessError, OSError, ValueError) as e:
                return self.send_json({"error": type(e).__name__}, 500)
        if path == "/health":  # лёгкий ответ для лаунчера: «это наш сервер и он жив»
            return self.send_json({"app": "token-gamble", "ok": True})
        return super().do_GET()

    def do_POST(self):
        global last_hit
        last_hit = time.monotonic()
        if self.foreign():
            return
        if self.path != "/round":
            return self.send_json({"error": "not found"}, 404)
        # только application/json: такой запрос с чужой страницы требует preflight, а его мы не пропускаем
        if self.headers.get_content_type() != "application/json":
            return self.send_json({"error": "content-type"}, 415)
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 4096:
                raise ValueError("too big")
            body = json.loads(self.rfile.read(n))
            if not isinstance(body, dict):
                raise ValueError("body")
        except (ValueError, TypeError) as e:
            return self.send_json({"error": str(e)}, 400)
        try:
            tokens = count_tokens()
        except (subprocess.SubprocessError, OSError, ValueError):
            tokens = None  # подсчёт упал — ход всё равно записываем, earned останется прежним
        # ход, начатый до полуночи, засчитывается вчерашнему дню, а не уводит новый в минус
        date = body.get("date") if body.get("date") in (today(), yesterday()) else today()
        try:
            with lock:
                h = load_history()
                day = h["days"].setdefault(date, new_day())
                apply_round(day, body, tokens["total"] if tokens and date == today() else 0)
                save_history(h)
        except (ValueError, KeyError, TypeError) as e:
            return self.send_json({"error": str(e)}, 400)
        try:
            return self.send_json(self.state(tokens))
        except (subprocess.SubprocessError, OSError, ValueError) as e:
            return self.send_json({"error": type(e).__name__}, 500)

    def log_message(self, format, *args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--idle", type=int, default=0, help="exit after N seconds without requests (0 = never)")
    a = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    if a.idle:
        def watchdog():
            while time.monotonic() - last_hit < a.idle:
                time.sleep(5)
            srv.shutdown()
        threading.Thread(target=watchdog, daemon=True).start()
    print(f"http://localhost:{a.port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
