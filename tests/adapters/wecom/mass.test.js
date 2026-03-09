import test from "node:test";
import assert from "node:assert/strict";
import { submitMassJobs } from "../../../src/adapters/wecom/mass.js";

test("returns both job ids when both targets are enabled", async () => {
  const result = await submitMassJobs({
    wecom_targets: {
      customer_groups: true,
      external_contacts: true
    }
  });

  assert.ok(result.customer_group_job_id);
  assert.ok(result.external_contact_job_id);
});
