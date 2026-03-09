export async function createLive(input) {
  return {
    live_id: input.live_id || "xet_live_mock_001",
    live_url: input.live_url || "https://example.xet.com/live/xet_live_mock_001"
  };
}
