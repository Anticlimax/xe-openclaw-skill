# xe-openclaw-skill

## Xiaoe 登录模式

小鹅通自动化支持两种登录方式:

1. 账号密码自动登录
2. 引导登录（扫码/人工登录）

### 引导登录示例

```js
import { createLiveWithPlaywright } from "./src/adapters/xet/live.js";
import * as playwright from "playwright";

const result = await createLiveWithPlaywright(
  {
    title: "春季新品直播",
    start_time: "2026-03-12 20:00"
  },
  {
    playwright,
    baseUrl: "https://admin.xiaoe-tech.com",
    headless: false,
    loginGuide: true,
    onLoginGuide: async (page) => {
      // 这里可以接入你的提示逻辑，比如通知操作者扫码后回车
      // 示例里直接等待登录成功 URL
      await page.waitForURL(/dashboard|home|index/);
    }
  }
);

console.log(result);
```

## OpenClaw 命令（当前可用）

1. 登录并保持会话

```bash
/xet login
```

2. 在当前登录会话中创建直播

```bash
/xet live create --title "3月新品场" --start "2026-03-10 20:00" --desc "今晚主推爆品"
```

2.5 自然语言模式（Skill 调度）

```bash
/xet 帮我登录小鹅通后台
/xet 帮我创建一场直播，标题叫春季上新，开始时间是2026-03-10 20:00
```

说明:
- 自然语言模式依赖 OpenClaw runtime 提供 `intent.resolve` 能力。
- 若当前 runtime 未提供该能力，插件会提示你改用显式命令。
- 插件已注册 Agent Tools: `xet_router`、`xet_login`、`xet_live_create`，推荐模型先调用 `xet_router` 做语义路由，再执行具体动作。

3. 查看/关闭会话

```bash
/xet session status
/xet session close
```
