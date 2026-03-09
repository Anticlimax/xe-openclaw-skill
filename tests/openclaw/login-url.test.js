import test from "node:test";
import assert from "node:assert/strict";
import { isMerchantLandingUrl } from "../../openclaw/index.js";

test("isMerchantLandingUrl only accepts merchant index page", () => {
  assert.equal(
    isMerchantLandingUrl("https://admin.xiaoe-tech.com/t/account/muti_index#/chooseShop"),
    false,
  );
  assert.equal(
    isMerchantLandingUrl("https://admin.xiaoe-tech.com/t/merchant/index"),
    true,
  );
  assert.equal(
    isMerchantLandingUrl("https://admin.xiaoe-tech.com/t/merchant/index#/dashboard"),
    true,
  );
  assert.equal(
    isMerchantLandingUrl("https://admin.xiaoe-tech.com/t/login#/acount"),
    false,
  );
});
