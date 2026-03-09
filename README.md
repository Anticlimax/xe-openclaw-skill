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
