export const COMMAND_SET = new Set([
  "xet.create_live",
  "xet.attach_commerce",
  "xet.prepare_message",
  "wecom.mass_to_customer_groups",
  "wecom.mass_to_external_contacts",
  "campaign.run",
  "campaign.status"
]);

export function isValidCommand(command) {
  return COMMAND_SET.has(command);
}
