import { validateRunCampaign } from "../schema/campaign.js";
import { CAMPAIGN_STATES, nextFinalState } from "./state-machine.js";
import { createLive as defaultCreateLive } from "../adapters/xet/live.js";
import { attachCommerce as defaultAttachCommerce } from "../adapters/xet/commerce.js";
import { submitMassJobs as defaultSubmitMassJobs } from "../adapters/wecom/mass.js";

export async function runCampaign(payload, deps = {}) {
  const check = validateRunCampaign(payload);
  if (!check.success) {
    return {
      status: CAMPAIGN_STATES.FAILED,
      errors: check.errors,
      steps: []
    };
  }

  const createLive = deps.createLive || defaultCreateLive;
  const attachCommerce = deps.attachCommerce || defaultAttachCommerce;
  const submitMassJobs = deps.submitMassJobs || defaultSubmitMassJobs;

  const steps = [];

  const live = await createLive(payload.live);
  steps.push({ name: "xet.create_live", status: "success", live_id: live.live_id });

  const commerceInput = {
    live_id: live.live_id,
    product_ids: payload.commerce?.product_ids || [],
    coupon_ids: payload.commerce?.coupon_ids || []
  };
  const commerce = await attachCommerce(commerceInput);
  steps.push({
    name: "xet.attach_commerce",
    status: commerce.status || "success",
    products_attached: commerce.products_attached || 0,
    coupons_attached: commerce.coupons_attached || 0
  });

  const jobs = await submitMassJobs(payload);
  const channelStatus = {
    customer_groups: jobs.customer_group_job_id ? "success" : "failed",
    external_contacts: jobs.external_contact_job_id ? "success" : "failed"
  };

  steps.push({
    name: "wecom.mass_to_customer_groups",
    status: channelStatus.customer_groups,
    job_id: jobs.customer_group_job_id
  });
  steps.push({
    name: "wecom.mass_to_external_contacts",
    status: channelStatus.external_contacts,
    job_id: jobs.external_contact_job_id
  });

  const status = nextFinalState(channelStatus);

  return {
    status,
    live,
    commerce,
    jobs,
    steps,
    retryable: status === CAMPAIGN_STATES.PARTIAL_FAILED || status === CAMPAIGN_STATES.FAILED
  };
}
