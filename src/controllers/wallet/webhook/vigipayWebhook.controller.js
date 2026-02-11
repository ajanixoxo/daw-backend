const WalletLedger = require("@models/walletLedger/ledger.js");
const User = require("@models/userModel/user");
const verifyVigipaySignature = require("@utils/vigipayClient/verifyWebhook.js");

exports.vigipayWebhook = async (req, res) => {
  try {
    console.log("Vigipay webhook received");

    // verify signature
    const isValid = verifyVigipaySignature(req);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { Code, Succeeded, Data } = req.body;

    if (!Data) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const {
      Reference,
      MerchantRef,
      Amount,
      Status,
      TransactionDate,
      BeneficiaryAccount,
      CustomerId
    } = Data;

    // idempotency check (reference OR merchantRef)
    const ledger = await WalletLedger.findOne({
      $or: [
        { reference: Reference },
        { merchantRef: MerchantRef }
      ]
    });

    // if already SUCCESS → ignore replay
    if (ledger && ledger.status === "SUCCESS") {
      return res.status(200).json({ message: "Already processed" });
    }

    const finalStatus =
      Succeeded && Code === "00" && Status === "Successful"
        ? "SUCCESS"
        : "FAILED";

    if (ledger) {
      // update existing ledger
      ledger.status = finalStatus;
      ledger.transactionDate = new Date(TransactionDate);
      ledger.beneficiaryAccount = BeneficiaryAccount;
      ledger.rawWebhookPayload = req.body;

      await ledger.save();

      return res.status(200).json({ message: "Ledger updated successfully" });
    }

    // if ledger not found, try linking by CustomerId
    const user = await User.findOne({ walletId: CustomerId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // create ledger from webhook
    await WalletLedger.create({
      userId: user._id,
      walletId: user.walletId,
      reference: Reference,
      merchantRef: MerchantRef,
      type: "DEBIT",
      amount: Amount,
      status: finalStatus,
      beneficiaryAccount: BeneficiaryAccount,
      transactionDate: new Date(TransactionDate),
      rawWebhookPayload: req.body
    });

    return res.status(200).json({
      message: "Ledger created from webhook"
    });

  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return res.status(500).json({
      message: "Webhook processing failed"
    });
  }
};
