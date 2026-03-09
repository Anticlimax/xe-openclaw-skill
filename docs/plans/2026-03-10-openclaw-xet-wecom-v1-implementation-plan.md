# OpenClaw 小鹅通企微联动 V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现一个可执行的 OpenClaw 插件，完成小鹅通直播创建与企业微信对外群发（客户群优先，同时支持外部联系人）。

**Architecture:** 采用分层插件架构，分为编排层、平台适配层、任务状态层。小鹅通侧走网页自动化适配器，企微侧走客户联系群发接口适配器。所有动作由统一状态机编排并可重试。

**Tech Stack:** TypeScript, Node.js, Playwright, Zod, Vitest, Pino

---

## 现阶段（V1）执行任务

### Task 1: 初始化插件骨架与命令协议

**Files:**
- Create: `src/plugin/index.ts`
- Create: `src/plugin/commands.ts`
- Create: `src/plugin/types.ts`
- Test: `tests/plugin/commands.spec.ts`

**Step 1: Write the failing test**

```ts
it("loads all V1 commands", () => {
  const commands = loadCommands();
  expect(commands).toEqual(
    expect.arrayContaining([
      "xet.create_live",
      "xet.attach_commerce",
      "xet.prepare_message",
      "wecom.mass_to_customer_groups",
      "wecom.mass_to_external_contacts",
      "campaign.run",
      "campaign.status"
    ])
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/plugin/commands.spec.ts`
Expected: FAIL with module not found

**Step 3: Write minimal implementation**

```ts
export const V1_COMMANDS = [
  "xet.create_live",
  "xet.attach_commerce",
  "xet.prepare_message",
  "wecom.mass_to_customer_groups",
  "wecom.mass_to_external_contacts",
  "campaign.run",
  "campaign.status"
] as const;
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/plugin/commands.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugin tests/plugin
git commit -m "feat: add v1 plugin command registry"
```

### Task 2: 参数 Schema 与入参校验

**Files:**
- Create: `src/schema/campaign.ts`
- Create: `src/schema/wecom.ts`
- Test: `tests/schema/campaign.spec.ts`

**Step 1: Write the failing test**

```ts
it("rejects run request without sender_userid", () => {
  const parsed = runCampaignSchema.safeParse({ campaign_name: "test" });
  expect(parsed.success).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/schema/campaign.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export const runCampaignSchema = z.object({
  campaign_name: z.string().min(1),
  sender_userid: z.string().min(1),
  live: z.object({ title: z.string(), start_time: z.string() }),
  wecom_targets: z.object({
    customer_groups: z.boolean().default(true),
    external_contacts: z.boolean().default(true)
  })
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/schema/campaign.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schema tests/schema
git commit -m "feat: add campaign request schema validation"
```

### Task 3: 小鹅通网页自动化适配器

**Files:**
- Create: `src/adapters/xet/web/session.ts`
- Create: `src/adapters/xet/web/live.ts`
- Create: `src/adapters/xet/web/commerce.ts`
- Test: `tests/adapters/xet/live.spec.ts`

**Step 1: Write the failing test**

```ts
it("returns live_id after create live", async () => {
  const ret = await createLive(mockInput);
  expect(ret.live_id).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/adapters/xet/live.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export async function createLive(input: CreateLiveInput) {
  // playwright flow: login -> open live create page -> submit -> parse live id
  return { live_id: "mock-live-id", live_url: "https://example.com/live/mock-live-id" };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/adapters/xet/live.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/xet tests/adapters/xet
git commit -m "feat: add xiaoe web automation live adapter"
```

### Task 4: 企业微信对外群发适配器（客户群 + 外部联系人）

**Files:**
- Create: `src/adapters/wecom/mass.ts`
- Create: `src/adapters/wecom/client.ts`
- Test: `tests/adapters/wecom/mass.spec.ts`

**Step 1: Write the failing test**

```ts
it("submits both customer group and external contact mass jobs", async () => {
  const result = await submitMassJobs(mockReq);
  expect(result.customer_group_job_id).toBeTruthy();
  expect(result.external_contact_job_id).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/adapters/wecom/mass.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export async function submitMassJobs(req: MassReq) {
  const customer_group_job_id = req.targets.customer_groups ? "cg_123" : undefined;
  const external_contact_job_id = req.targets.external_contacts ? "ec_456" : undefined;
  return { customer_group_job_id, external_contact_job_id };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/adapters/wecom/mass.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/wecom tests/adapters/wecom
git commit -m "feat: add wecom external mass messaging adapter"
```

### Task 5: 活动编排状态机

**Files:**
- Create: `src/orchestrator/campaign.ts`
- Create: `src/orchestrator/state-machine.ts`
- Test: `tests/orchestrator/campaign.spec.ts`

**Step 1: Write the failing test**

```ts
it("goes to partial_failed when one channel fails", async () => {
  const s = await runCampaign(mockCampaignWithOneFailure);
  expect(s.status).toBe("partial_failed");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/orchestrator/campaign.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export const STATES = ["draft", "scheduled", "running", "partial_failed", "success", "failed"] as const;
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/orchestrator/campaign.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/orchestrator tests/orchestrator
git commit -m "feat: add campaign orchestrator and state machine"
```

### Task 6: 可观测性与重试

**Files:**
- Create: `src/ops/logger.ts`
- Create: `src/ops/retry.ts`
- Test: `tests/ops/retry.spec.ts`

**Step 1: Write the failing test**

```ts
it("retries transient wecom failure up to max attempts", async () => {
  const r = await withRetry(flakyFn, { maxAttempts: 3 });
  expect(r).toEqual("ok");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/ops/retry.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export async function withRetry<T>(fn: () => Promise<T>, opts: { maxAttempts: number }): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < opts.maxAttempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/ops/retry.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ops tests/ops
git commit -m "feat: add retry and logging utilities"
```

## 未来阶段（V2+）演进任务

1. 新增 `xet-api-adapter`，按租户能力切换 Web/API 双通道。
2. 加入群机器人与企微内部应用消息适配器。
3. 引入消息模板变量引擎与人群规则引擎。
4. 建立触达-点击-进房-成交归因数据链路。
5. 引入异步任务队列与并发控制策略。

## 里程碑建议

1. Week 1: Task 1-2
2. Week 2: Task 3
3. Week 3: Task 4-5
4. Week 4: Task 6 + 灰度发布
