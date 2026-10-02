#!/usr/bin/env python3
"""Open token-gamble: start the local server if it isn't running yet, open a browser tab, print the URL.
Stdlib only, works on Linux, macOS, WSL and native Windows."""
import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
SERVE = os.path.join(HERE, "serve.py")


def ours(port):
    # 127.0.0.1, not localhost: the server listens on IPv4 only
    try:
        # no proxy: HTTP_PROXY would otherwise route even 127.0.0.1 through it
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(f"http://127.0.0.1:{port}/health", timeout=2) as r:
            return json.load(r).get("app") == "token-gamble"
    except Exception:  # anything else on the port (non-HTTP, non-JSON, a list) is simply not us
        return False


def busy(port, timeout=0.3):
    # short timeout on purpose: Windows retries a refused localhost connect for ~2 s
    with socket.socket() as s:
        s.settimeout(timeout)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start(port, idle):
    cmd = [sys.executable, SERVE, "--port", str(port), "--idle", str(idle)]
    kw = dict(stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.name == "nt":
        # pythonw: no console window, and serve.py's own child processes inherit that
        pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if os.path.exists(pyw):
            cmd[0] = pyw
        kw["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kw["start_new_session"] = True  # survives the terminal / agent shell closing
    subprocess.Popen(cmd, **kw)


def is_wsl():
    try:
        with open("/proc/version") as f:
            return "microsoft" in f.read().lower()
    except OSError:
        return False


def open_browser(url):
    quiet = dict(stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if is_wsl():  # WSL -> the Windows browser
            cwd = "/mnt/c" if os.path.isdir("/mnt/c") else None  # cmd.exe complains about UNC cwd
            if subprocess.run(["cmd.exe", "/c", "start", "", url], cwd=cwd, **quiet).returncode:
                subprocess.run(["explorer.exe", url], **quiet)
        elif sys.platform.startswith("linux"):
            # not webbrowser: with no GUI it falls back to lynx/w3m and grabs the terminal
            subprocess.run(["xdg-open", url], **quiet)
        else:
            webbrowser.open(url)
    except OSError:
        pass  # no browser launcher; the printed URL is enough


def main():
    env = os.environ.get
    ap = argparse.ArgumentParser(
        prog="token-gamble",
        description="Open token-gamble: start the local server if needed and open it in the browser.",
        epilog="Environment: TOKEN_GAMBLE_PORT (default 8777), TOKEN_GAMBLE_IDLE (seconds without "
               "requests before the server exits, default 300), TOKEN_GAMBLE_NO_OPEN=1 (don't open a browser).")
    ap.add_argument("--port", type=int, default=int(env("TOKEN_GAMBLE_PORT") or 8777), help="port to use")
    ap.add_argument("--idle", type=int, default=int(env("TOKEN_GAMBLE_IDLE") or 300),
                    help="server exits after this many idle seconds (0 = never)")
    ap.add_argument("--no-open", action="store_true", default=env("TOKEN_GAMBLE_NO_OPEN", "") not in ("", "0"),
                    help="only start the server and print the URL")
    a = ap.parse_args()
    url = f"http://localhost:{a.port}/"

    if busy(a.port):
        if not ours(a.port):
            sys.exit(f"token-gamble: port {a.port} is taken by something else. "
                     f"Try another one: TOKEN_GAMBLE_PORT={a.port + 1} token-gamble")
    else:
        start(a.port, a.idle)
        deadline = time.monotonic() + 10
        while not busy(a.port) and time.monotonic() < deadline:
            time.sleep(0.1)
        if not ours(a.port):
            sys.exit(f"token-gamble: the server didn't start. Run it by hand to see why: "
                     f"\"{sys.executable}\" \"{SERVE}\" --port {a.port}")

    if not a.no_open:
        open_browser(url)
    print(url)


if __name__ == "__main__":
    main()
