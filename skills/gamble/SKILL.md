---
name: gamble
description: Open gamble-your-tokens, a joke casino where the currency is the tokens spent on AI agents today. Use when the user writes "/gamble", "let's gamble", "open the casino", "I want to spin", "blow my tokens", "I'm fed up, let's play", or in Russian «давай погемблим», «открой казино», «хочу крутануть», «спустить токены», «заебался, давай поиграем».
---

Run the launcher that ships next to this skill: `app/launch.py`, two directories up from this skill's own directory. On Linux, macOS and WSL:

```bash
python3 "<this skill's directory>/../../app/launch.py"
```

On native Windows use `py -3` instead of `python3` (or `python` if there is no `py`). The launcher starts a local server if it isn't running yet, opens a browser tab and prints the URL.

It needs localhost and a browser launch, so it won't work inside a sandbox without network. Run it outside the sandbox (with elevated permissions) right away instead of trying inside first.

Reply with one short joking line in the user's language, no lecture about the harms of gambling: the game already has those. Don't offer to play yourself and don't lure the user in: only the user opens the game.
