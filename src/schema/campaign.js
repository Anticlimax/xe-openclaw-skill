function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateRunCampaign(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { success: false, errors: ["payload must be an object"] };
  }

  if (!isNonEmptyString(payload.campaign_name)) {
    errors.push("campaign_name is required");
  }

  if (!isNonEmptyString(payload.sender_userid)) {
    errors.push("sender_userid is required");
  }

  if (!payload.live || typeof payload.live !== "object") {
    errors.push("live is required");
  } else {
    if (!isNonEmptyString(payload.live.title)) {
      errors.push("live.title is required");
    }
    if (!isNonEmptyString(payload.live.start_time)) {
      errors.push("live.start_time is required");
    }
  }

  const targets = payload.wecom_targets;
  if (!targets || typeof targets !== "object") {
    errors.push("wecom_targets is required");
  } else {
    if (typeof targets.customer_groups !== "boolean") {
      errors.push("wecom_targets.customer_groups must be boolean");
    }
    if (typeof targets.external_contacts !== "boolean") {
      errors.push("wecom_targets.external_contacts must be boolean");
    }
  }

  return { success: errors.length === 0, errors };
}
