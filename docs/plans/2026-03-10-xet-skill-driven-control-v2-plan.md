# XET Skill-Driven Control V2 Plan

## Goal

在 OpenClaw 中实现“自然语言 -> Skill 意图 -> Plugin 执行”的正统链路，让用户可以直接说业务目标（登录、创建直播），系统自动解析并执行，且复用当前浏览器登录会话。

## Scope

### Current Phase (Now)

1. 建立 Skill 意图层（结构化输出）
- 定义 `intent schema`:
  - `xet.login`
  - `xet.live.create`
- 字段约束:
  - `xet.live.create.title` 必填
  - `xet.live.create.start_time` 必填（格式 `YYYY-MM-DD HH:mm`）
  - `description` 可选

2. 建立 Plugin 执行层（已有能力扩展）
- 执行器路由:
  - `xet.login` -> 复用现有 `/xet login`
  - `xet.live.create` -> 复用现有 active Playwright session 完成创建直播
- 严格禁止执行器做语义猜测，只接受结构化参数

3. 建立 Skill->Plugin 调度层
- 输入: 自然语言
- 输出: 结构化 intent JSON
- 调度: 按 `intent` 调插件命令
- 参数缺失: 触发追问，不执行

4. 增加安全与确认
- 高风险动作（发布直播）执行前确认（可配置开关）
- 未登录态自动引导到 `xet.login`
- 失败返回可读错误 + 下一步建议

5. 测试与验收
- 单测:
  - intent schema 校验
  - 调度路由正确性
  - 执行器参数检查
- 集成验收:
  - 自然语言触发登录
  - 自然语言触发创建直播
  - 登录态复用不要求重复扫码

## Future Phase (Later)

1. 意图扩展
- `xet.commerce.attach`（带货商品、优惠券）
- `wecom.mass.customer_group`
- `wecom.mass.external_contact`

2. 计划型任务
- 一句话触发完整 Campaign：创建直播 -> 绑定带货/券 -> 企微群发
- 支持 dry-run（仅生成执行计划，不落地）

3. 可观测性
- 每步 trace id
- 结构化执行日志
- 失败快照与重放

4. 语义质量提升
- Few-shot 意图示例集
- 参数纠错（时间、标题、商品 id）
- 多轮追问策略

## Milestones

1. M1: Skill 意图 + 两个动作（login/create_live）闭环
- DoD: 能自然语言执行登录与创建直播

2. M2: 带货与优惠券动作闭环
- DoD: 创建直播后可自然语言添加商品与优惠券

3. M3: 企微客户群/外部联系人群发闭环
- DoD: 自然语言可完成“创建+分发”

## Risks

1. 小鹅通后台页面选择器变化
- Mitigation: 选择器配置化 + 回退候选

2. 会话失效导致动作中断
- Mitigation: 执行前会话探测 + 自动转登录

3. 自然语言误判
- Mitigation: schema 强校验 + 发布前确认

## Implementation Order

1. `intent schema` 与调度器
2. `xet.login` 意图接入
3. `xet.live.create` 意图接入
4. 参数追问与执行确认
5. 集成测试与手工回归

