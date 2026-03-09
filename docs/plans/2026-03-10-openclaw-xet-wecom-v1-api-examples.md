# OpenClaw x 小鹅通 x 企业微信 V1 API 示例

**日期**: 2026-03-10
**说明**: 以下为插件层统一协议示例，方便前后端或 Agent 调用对齐。

---

## 1. `campaign.run` 一键执行

### Request

```json
{
  "command": "campaign.run",
  "request_id": "req_20260310_001",
  "payload": {
    "campaign_name": "3月直播首发场",
    "sender_userid": "zhangsan",
    "trigger": {
      "mode": "scheduled",
      "schedule_at": "2026-03-12T19:20:00+08:00"
    },
    "live": {
      "title": "春季新品直播",
      "start_time": "2026-03-12T20:00:00+08:00",
      "cover_image": "https://cdn.example.com/cover/live-001.png",
      "description": "新品讲解+限时福利"
    },
    "commerce": {
      "product_ids": ["p1001", "p1002"],
      "coupon_ids": ["c2001"]
    },
    "message": {
      "template_id": "live_launch_v1",
      "custom_text": "今晚8点开播，点击直达直播间",
      "append_ops_info": true
    },
    "wecom_targets": {
      "customer_groups": true,
      "external_contacts": true,
      "priority": "customer_groups"
    }
  }
}
```

### Response

```json
{
  "request_id": "req_20260310_001",
  "campaign_id": "camp_8f31aa",
  "status": "scheduled",
  "next_action": "wait_schedule"
}
```

---

## 2. `xet.create_live` 创建直播

### Request

```json
{
  "command": "xet.create_live",
  "payload": {
    "title": "春季新品直播",
    "start_time": "2026-03-12T20:00:00+08:00",
    "host_user": "运营A",
    "cover_image": "https://cdn.example.com/cover/live-001.png",
    "description": "新品讲解+限时福利"
  }
}
```

### Response

```json
{
  "live_id": "xet_live_456789",
  "live_url": "https://example.xet.com/live/456789",
  "status": "created"
}
```

---

## 3. `xet.attach_commerce` 添加带货与优惠券

### Request

```json
{
  "command": "xet.attach_commerce",
  "payload": {
    "live_id": "xet_live_456789",
    "product_ids": ["p1001", "p1002"],
    "coupon_ids": ["c2001"]
  }
}
```

### Response

```json
{
  "live_id": "xet_live_456789",
  "products_attached": 2,
  "coupons_attached": 1,
  "status": "success"
}
```

---

## 4. `wecom.mass_to_customer_groups` 客户群群发（P0）

### Request

```json
{
  "command": "wecom.mass_to_customer_groups",
  "payload": {
    "corp_id": "ww123456",
    "agent_id": "1000002",
    "sender_userid": "zhangsan",
    "content": {
      "text": "今晚8点开播，点击进入直播间：https://example.xet.com/live/456789"
    },
    "group_filter": {
      "tag_ids": ["tag_live_intent"],
      "include_recent_active_days": 30
    },
    "idempotency_key": "camp_8f31aa_customer_groups"
  }
}
```

### Response

```json
{
  "job_id": "wecom_cg_job_987",
  "target_type": "customer_groups",
  "status": "submitted"
}
```

---

## 5. `wecom.mass_to_external_contacts` 外部联系人群发（P1）

### Request

```json
{
  "command": "wecom.mass_to_external_contacts",
  "payload": {
    "corp_id": "ww123456",
    "agent_id": "1000002",
    "sender_userid": "zhangsan",
    "content": {
      "text": "直播即将开始，点击直达：https://example.xet.com/live/456789"
    },
    "contact_filter": {
      "tag_ids": ["tag_high_intent"],
      "follow_userids": ["zhangsan"]
    },
    "idempotency_key": "camp_8f31aa_external_contacts"
  }
}
```

### Response

```json
{
  "job_id": "wecom_ec_job_321",
  "target_type": "external_contacts",
  "status": "submitted"
}
```

---

## 6. `campaign.status` 查询任务状态

### Request

```json
{
  "command": "campaign.status",
  "payload": {
    "campaign_id": "camp_8f31aa"
  }
}
```

### Response

```json
{
  "campaign_id": "camp_8f31aa",
  "status": "partial_failed",
  "steps": [
    {
      "name": "xet.create_live",
      "status": "success"
    },
    {
      "name": "wecom.mass_to_customer_groups",
      "status": "success",
      "job_id": "wecom_cg_job_987"
    },
    {
      "name": "wecom.mass_to_external_contacts",
      "status": "failed",
      "error_code": "WECOM_PERMISSION_DENIED",
      "error_message": "sender_userid not authorized"
    }
  ],
  "retryable": true
}
```

---

## 7. 错误码建议

```json
{
  "XET_LOGIN_EXPIRED": "小鹅通登录态失效",
  "XET_SELECTOR_CHANGED": "页面元素定位失效",
  "WECOM_PERMISSION_DENIED": "企业微信权限不足",
  "WECOM_RATE_LIMITED": "企业微信接口限流",
  "CAMPAIGN_DUPLICATED": "幂等键冲突，重复执行被拒绝"
}
```

## 8. 回调事件建议（可选）

```json
{
  "event": "campaign.step.updated",
  "campaign_id": "camp_8f31aa",
  "step": "wecom.mass_to_customer_groups",
  "status": "success",
  "occurred_at": "2026-03-12T19:21:30+08:00"
}
```
