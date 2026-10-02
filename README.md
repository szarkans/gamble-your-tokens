<h1 align="center">gamble your tokens</h1>

<p align="center"><a href="README.ru.md">[🇷🇺 →]</a> · <a href="README.zh.md">[🇨🇳 →]</a> </p>

<p align="center"><img src="assets/screenshot.png" alt="gamble your tokens" width="720"></p>

---

<h2 align="center">what's this about?</h2>

a joke casino for vibe coders. every token your AI agents burned today becomes a chip, 1:1 - and you can lose them all on slots, roulette and blackjack.

counts tokens from:

- claude code
- codex
- opencode

whatever is installed gets picked up. logs are read locally, nothing leaves your machine.

<h2 align="center">what's the point?</h2>

none. you spent 40 million tokens today making the agent rename one variable - might as well watch them burn in style.

no real money. nothing to buy, nothing to cash out, never will be. chips reset at midnight, your records don't. a win plays sounds, shakes the table and throws coins at you. a loss... you know how it feels already.

<h2 align="center">install</h2>

claude code
```bash
claude plugin marketplace add szarkans/gamble-your-tokens
claude plugin install gamble@gamble-your-tokens
```

codex
```bash
codex plugin marketplace add szarkans/gamble-your-tokens
codex plugin add gamble@gamble-your-tokens
```

<h3 align="center">other hosts</h3>

just ask your agent lmao:

```
Fetch and follow instructions from https://raw.githubusercontent.com/szarkans/gamble-your-tokens/main/INSTALL.md
```

requirements: `python3`. no pip installs, no node, no dependencies. works on linux, macos, windows and wsl.

<h2 align="center">play</h2>

`/gamble` in claude code, `$gamble:gamble` in codex, or just tell your agent "let's gamble". a tab opens at `http://localhost:8777/`. close the tab and the server shuts itself down a few minutes later.

the window can be tiny - keep it next to your agent, the table and the spin button always fit.

speaks english, russian, spanish, chinese, korean and japanese - picks your system language, switch it in the corner.

<h2 align="center">knobs</h2>

| variable               | default | what it does                                     |
| ---------------------- | ------- | ------------------------------------------------ |
| `TOKEN_GAMBLE_PORT`    | `8777`  | port of the local server                         |
| `TOKEN_GAMBLE_IDLE`    | `300`   | seconds without the tab before the server exits  |
| `TOKEN_GAMBLE_NO_OPEN` |         | `1` = start the server, don't open a browser     |

your agents' own `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `XDG_DATA_HOME` are respected. history of your days lives in `~/.local/share/token-gamble/history.json`.

<h2 align="center">hacking on it</h2>

```bash
XDG_DATA_HOME=$PWD/.scratch/data python3 app/serve.py   # test spins stay out of your real history
python3 app/test_serve.py
node tools/i18n-check.mjs                               # every language has every string
```

plain html + js, no build step: `app/web/`. games in `app/web/games/`, translations in `app/web/lang/`. another harness = one line in `SOURCES` in `app/count_today.py`.

<h2 align="center">license</h2>

MIT. the pixel font is Press Start 2P under the SIL Open Font License, see [`licenses/`](licenses/).

<h2 align="center">gambling is bad, m'kay</h2>

real gambling ruins lives. this one only ruins your context window.
