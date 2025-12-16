const verifySignature = require("../utils/verifyWebhook");

exports.vigipayWebhook = async (req, res) => {
  const isValid = verifySignature(req);

  if (!isValid) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const { Data } = req.body;

  /*
    Data.Status => Successful / Failed
    Data.Reference => Transaction reference
  */

  if (Data.Status === "Successful") {
    // ✅ Update transaction as successful in DB
  } else {
    // ❌ Mark transaction as failed
  }

  return res.status(200).json({ received: true });
};
