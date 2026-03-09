import test from "node:test";
import assert from "node:assert/strict";
import { runCampaign } from "../../src/orchestrator/campaign.js";

test("runs commerce attachment after live creation", async () => {
  const callOrder = [];

  const result = await runCampaign(
    {
      campaign_name: "test",
      sender_userid: "zhangsan",
      live: { title: "live", start_time: "2026-03-12T20:00:00+08:00" },
      commerce: { product_ids: ["p1"], coupon_ids: ["c1"] },
      wecom_targets: { customer_groups: true, external_contacts: true }
    },
    {
      createLive: async () => {
        callOrder.push("create_live");
        return { live_id: "live_001", live_url: "https://xet.test/live/live_001" };
      },
      attachCommerce: async () => {
        callOrder.push("attach_commerce");
        return { products_attached: 1, coupons_attached: 1, status: "success" };
      },
      submitMassJobs: async () => {
        callOrder.push("mass_send");
        return { customer_group_job_id: "cg_001", external_contact_job_id: "ec_001" };
      }
    }
  );

  assert.deepEqual(callOrder, ["create_live", "attach_commerce", "mass_send"]);
  assert.equal(result.status, "success");
  assert.ok(result.steps.find((s) => s.name === "xet.attach_commerce"));
});

test("goes to partial_failed when one channel fails", async () => {
  const result = await runCampaign(
    {
      campaign_name: "test",
      sender_userid: "zhangsan",
      live: { title: "live", start_time: "2026-03-12T20:00:00+08:00" },
      commerce: { product_ids: [], coupon_ids: [] },
      wecom_targets: { customer_groups: true, external_contacts: true }
    },
    {
      attachCommerce: async () => ({ products_attached: 0, coupons_attached: 0, status: "success" }),
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
      commerce: { product_ids: [], coupon_ids: [] },
      wecom_targets: { customer_groups: true, external_contacts: true }
    },
    {
      attachCommerce: async () => ({ products_attached: 0, coupons_attached: 0, status: "success" }),
      submitMassJobs: async () => ({ customer_group_job_id: "cg_001", external_contact_job_id: "ec_001" })
    }
  );

  assert.equal(result.status, "success");
  assert.equal(result.retryable, false);
});
