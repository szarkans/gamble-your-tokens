# Installing gamble your tokens

You are an agent reading this because a person asked you to install gamble your tokens.
Work out which harness you are, do that section only, then run the check at the end.

Needs `python3` (3.8+). No other dependencies.

## Claude Code

```bash
claude plugin marketplace add szarkans/gamble-your-tokens
claude plugin install gamble@gamble-your-tokens
```

Restart Claude Code. The skill is `/gamble:gamble` (plain `/gamble` works too unless another skill has that name).

## Codex CLI or Codex app

```bash
codex plugin marketplace add szarkans/gamble-your-tokens
codex plugin add gamble@gamble-your-tokens
```

The skill is `$gamble:gamble`. Codex installs a copy: to update, run `codex plugin remove gamble@gamble-your-tokens` and `codex plugin add gamble@gamble-your-tokens` again.

## OpenCode and anything else

Clone once:

```bash
git clone https://github.com/szarkans/gamble-your-tokens ~/.local/share/gamble-your-tokens
```

For OpenCode, add the clone's `skills` directory to `skills.paths` in the global `~/.config/opencode/opencode.json` (create the file if it is missing, merge if it exists):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": ["~/.local/share/gamble-your-tokens/skills"]
  }
}
```

A harness without skills can still open the game: `python3 ~/.local/share/gamble-your-tokens/app/launch.py`.

## Check

Run the launcher from wherever it got installed, without opening a browser:

```bash
python3 <install dir>/app/launch.py --no-open
```

It prints `http://localhost:8777/`. Tell the person to type the skill name (above) to play.
