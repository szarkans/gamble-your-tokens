<h1 align="center">gamble your tokens</h1>

<p align="center"><a href="README.md">[🇬🇧 →]</a> · <a href="README.ru.md">[🇷🇺 →]</a> </p>

<p align="center"><img src="assets/screenshot.png" alt="gamble your tokens" width="720"></p>

---

<h2 align="center">这是什么？</h2>

给 vibe coder 的恶搞赌场。你的 AI 智能体今天烧掉的每一个 token 都按 1:1 变成筹码 - 然后你可以在老虎机、轮盘和二十一点里把它们输光。

统计以下工具的 token：

- claude code
- codex
- opencode

装了哪个就算哪个。日志只在本地读取，什么都不会离开你的电脑。

<h2 align="center">有什么意义？</h2>

没有。你今天花了 4000 万 token 让智能体改了一个变量名 - 不如看它们烧得漂亮点。

没有真钱。不能充值，不能提现，以后也不会有。筹码午夜清零，纪录永远保留。赢了会响、会震、会往你脸上撒金币。输了……你本来就知道那是什么感觉。

<h2 align="center">安装</h2>

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

<h3 align="center">其他工具</h3>

直接让你的智能体来：

```
Fetch and follow instructions from https://raw.githubusercontent.com/szarkans/gamble-your-tokens/main/INSTALL.md
```

需要 `python3`。不用 pip，不用 node，零依赖。支持 linux、macos、windows 和 wsl。

<h2 align="center">开玩</h2>

在 claude code 里输入 `/gamble`，在 codex 里输入 `$gamble:gamble`，或者直接跟智能体说"来赌一把"。会打开 `http://localhost:8777/`。关掉标签页，几分钟后服务器自己退出。

窗口可以开得很小，放在智能体旁边 - 牌桌和旋转按钮永远放得下。

支持英语、俄语、西班牙语、中文、韩语和日语 - 跟随系统语言，可以在角落里切换。

<h2 align="center">设置</h2>

| 变量                   | 默认值 | 作用                             |
| ---------------------- | ------ | -------------------------------- |
| `TOKEN_GAMBLE_PORT`    | `8777` | 本地服务器端口                   |
| `TOKEN_GAMBLE_IDLE`    | `300`  | 没有标签页多少秒后服务器退出     |
| `TOKEN_GAMBLE_NO_OPEN` |        | `1` = 只启动服务器，不打开浏览器 |

会读取你的智能体自己的 `CLAUDE_CONFIG_DIR`、`CODEX_HOME` 和 `XDG_DATA_HOME`。每天的记录在 `~/.local/share/token-gamble/history.json`。

<h2 align="center">折腾代码</h2>

```bash
XDG_DATA_HOME=$PWD/.scratch/data python3 app/serve.py   # 测试转的不会进真实记录
python3 app/test_serve.py
node tools/i18n-check.mjs                               # 每种语言都有全部字符串
```

纯 html + js，无需构建：`app/web/`。游戏在 `app/web/games/`，翻译在 `app/web/lang/`。新增一个工具 = 在 `app/count_today.py` 的 `SOURCES` 里加一行。

<h2 align="center">许可证</h2>

MIT。像素字体是 Press Start 2P，使用 SIL Open Font License，见 [`licenses/`](licenses/)。

<h2 align="center">赌博有害</h2>

真正的赌博毁人生。这个只毁你的上下文窗口。
