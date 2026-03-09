import test from "node:test";
import assert from "node:assert/strict";
import { validateRunCampaign } from "../../src/schema/campaign.js";

test("rejects payload without sender_userid", () => {
  const result = validateRunCampaign({
    campaign_name: "test",
    live: { title: "live", start_time: "2026-03-12T20:00:00+08:00" },
    wecom_targets: { customer_groups: true, external_contacts: true }
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.includes("sender_userid is required"));
});

test("accepts valid campaign payload", () => {
  const result = validateRunCampaign({
    campaign_name: "test",
    sender_userid: "zhangsan",
    live: { title: "live", start_time: "2026-03-12T20:00:00+08:00" },
    wecom_targets: { customer_groups: true, external_contacts: false }
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.errors, []);
});
