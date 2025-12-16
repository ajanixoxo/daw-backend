const WalletLedger = require("@models/walletLedger/ledger.js");
const User = require("@models/userModel/user");
const verifyVigipaySignature = require("@utils/vigipayClient/verifyWebhook.js");

exports.vigipayWebhook = async (req, res) => {
  try {
    
    const isValid = verifyVigipaySignature(req);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { Code, Succeeded, Data } = req.body;

    if (!Succeeded || Code !== "00") {
      return res.status(200).json({ message: "Ignored non-success event" });
    }

    const {
      Reference,
      MerchantRef,
      Amount,
      Status,
      TransactionDate,
      BeneficiaryAccount,
      CustomerId,
    } = Data;

  
    const existingTxn = await WalletLedger.findOne({ reference: Reference });
    if (existingTxn) {
      return res.status(200).json({ message: "Duplicate webhook ignored" });
    }

    const user = await User.findOne({ walletId: CustomerId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await WalletLedger.create({
      userId: user._id,
      walletId: user.walletId,
      reference: Reference,
      merchantRef: MerchantRef,
      type: "DEBIT",
      amount: Amount,
      status: Status === "Successful" ? "SUCCESS" : "FAILED",
      beneficiaryAccount: BeneficiaryAccount,
      transactionDate: new Date(TransactionDate),
      rawWebhookPayload: req.body,
    });

    return res.status(200).json({ message: "Webhook processed successfully" });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};
