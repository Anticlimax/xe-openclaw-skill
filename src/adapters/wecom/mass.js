export async function submitMassJobs(request) {
  return {
    customer_group_job_id: request.wecom_targets?.customer_groups ? "wecom_cg_job_mock" : undefined,
    external_contact_job_id: request.wecom_targets?.external_contacts ? "wecom_ec_job_mock" : undefined
  };
}
