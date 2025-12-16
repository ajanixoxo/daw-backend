const crypto = require("crypto");

module.exports = function verifyVigipaySignature(req) {
  const signature = req.headers["vigipay-signature"];
  if (!signature) return false;

  const payload = req.rawBody; 
  const integrationKey = process.env.VIGIPAY_INTEGRATION_KEY;

  const computedHash = crypto
    .createHmac("sha512", integrationKey)
    .update(payload)
    .digest("hex");

  return computedHash === signature;
};
