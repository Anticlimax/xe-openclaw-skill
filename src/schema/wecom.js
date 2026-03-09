function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateMassRequest(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { success: false, errors: ["payload must be an object"] };
  }

  if (!isNonEmptyString(payload.corp_id)) {
    errors.push("corp_id is required");
  }

  if (!isNonEmptyString(payload.agent_id)) {
    errors.push("agent_id is required");
  }

  if (!isNonEmptyString(payload.sender_userid)) {
    errors.push("sender_userid is required");
  }

  if (!payload.content || typeof payload.content !== "object") {
    errors.push("content is required");
  }

  return { success: errors.length === 0, errors };
}
