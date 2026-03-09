import test from "node:test";
import assert from "node:assert/strict";
import { runCampaign } from "../../src/orchestrator/campaign.js";

test("goes to partial_failed when one channel fails", async () => {
  const result = await runCampaign(
    {
      campaign_name: "test",
      sender_userid: "zhangsan",
      live: { title: "live", start_time: "2026-03-12T20:00:00+08:00" },
      wecom_targets: { customer_groups: true, external_contacts: true }
    },
    {
      submitMassJobs: async () => ({ customer_group_job_id: "cg_001", external_contact_job_id: undefined })
    }
  );

  assert.equal(result.status, "partial_failed");
  assert.equal(result.retryable, true);
});

test("goes to success when both channels succeed", async () => {
  const result = await runCampaign(
    {
      campaign_name: "test",
      sender_userid: "zhangsan",
      live: { title: "live", start_time: "2026-03-12T20:00:00+08:00" },
      wecom_targets: { customer_groups: true, external_contacts: true }
    },
    {
      submitMassJobs: async () => ({ customer_group_job_id: "cg_001", external_contact_job_id: "ec_001" })
    }
  );

  assert.equal(result.status, "success");
  assert.equal(result.retryable, false);
});
