export const CAMPAIGN_STATES = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  RUNNING: "running",
  PARTIAL_FAILED: "partial_failed",
  SUCCESS: "success",
  FAILED: "failed"
};

export function nextFinalState(results) {
  const values = Object.values(results);
  const hasSuccess = values.some((v) => v === "success");
  const hasFailed = values.some((v) => v === "failed");

  if (hasSuccess && hasFailed) {
    return CAMPAIGN_STATES.PARTIAL_FAILED;
  }
  if (hasFailed) {
    return CAMPAIGN_STATES.FAILED;
  }
  return CAMPAIGN_STATES.SUCCESS;
}
