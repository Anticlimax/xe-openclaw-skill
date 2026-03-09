import { validateRunCampaign } from "../schema/campaign.js";
import { CAMPAIGN_STATES, nextFinalState } from "./state-machine.js";
import { createLive as defaultCreateLive } from "../adapters/xet/live.js";
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
  const submitMassJobs = deps.submitMassJobs || defaultSubmitMassJobs;

  const steps = [];
  let status = CAMPAIGN_STATES.RUNNING;

  const live = await createLive(payload.live);
  steps.push({ name: "xet.create_live", status: "success", live_id: live.live_id });

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

  status = nextFinalState(channelStatus);

  return {
    status,
    live,
    jobs,
    steps,
    retryable: status === CAMPAIGN_STATES.PARTIAL_FAILED || status === CAMPAIGN_STATES.FAILED
  };
}
