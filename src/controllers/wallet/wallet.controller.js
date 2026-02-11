const vigipayClient = require("../../utils/vigipayClient/vigipayClient.js");
const User = require("../../models/userModel/user.js");
const walletLedger = require("../../models/walletLedger/ledger.js");
const { v4: uuidv4 } = require("uuid");

exports.createStatic = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bvn, dateOfBirth } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.accountId) {
      return res.status(400).json({ message: "Account already exists" });
    }
    // console.log("Vigipay Response:");
    const response = await vigipayClient.post("/api/VirtualAccount/create", {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phone,
      bvn,
      dateOfBirth,
      webhookUrl: process.env.WEBHOOK_URL
    });
    console.log("Vigipay Response:", response);
    const accountId = response.data.responseData.accountId;
    console.log("Vigipay Account ID:", accountId);
    // Save accountId to user
    user.accountId = accountId;
    user.accountNo = response.data.responseData.accountNo;
    user.accountName = response.data.responseData.accountName;
    user.bankName = response.data.responseData.bankName;
    user.bankCode = response.data.responseData.bankCode;
    await user.save();

    return res.status(201).json({
      message: "Wallet created successfully",
      accountId,
      data: response.data.responseData
    });
  } catch (error) {
    return res.status(500).json({
      message: "Wallet creation failed",
      error: error.response?.data || error.message
    });
  }
};

exports.getBusinessWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if(user.roles !== "admin"){
      return res.status(400).json({
        message: "you are not eligible"
      });
    }
    console.log("vigipay starting");
    const response = await vigipayClient.get("/api/Wallet/businessWallet");
    console.log("response for wallet from vigipay", response);

    const walletData = response.data.responseData.walletID;
    const currentBalance = response.data.responseData.currentBalance;

    if (!user.walletId) {
      user.walletId = walletData;
    }

    user.wallet_balance = currentBalance;

    await user.save();

    return res.status(200).json({
      message: "Wallet retrieved successfully",
      data: response.data.responseData
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch wallet",
      error: error.response?.data || error.message
    });
  }
};


//update walletPin
exports.updateWalletPin = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pin } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.walletId) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    if(user.roles !== "admin"){
      return res.status(400).json({
        message: "you are not eligible"
      });
    }

    const response = await vigipayClient.put(
      "/api/Wallet/updatePin",
      {
        walletId: user.walletId,
        pin
      },
      {
        baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL
      }
    );

    return res.status(200).json({
      message: "Wallet PIN updated successfully",
      data: response.data
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update wallet PIN",
      error: error.response?.data || error.message
    });
  }
};

//process payout
exports.processPayout = async (req, res) => {
  let ledger;
  try {
    const userId = req.user._id;
    const { pin, amount, bankCode, accountNumber, accountName } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(userId);
    if (!user || !user.walletId) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // If roles is array (recommended)
    if (!user.roles || !user.roles.includes("admin")) {
      return res.status(403).json({
        message: "You are not eligible"
      });
    }

    //Generate merchant reference (YOUR reference)
    const merchantRef = `PAYOUT_${uuidv4()}`;

    // Get charge details
    const chargeRes = await vigipayClient.post("/api/Wallet/charge", {
      amount,
      transferType: "WalletToAccount"
    });

    const { totalAmount } = chargeRes.data.responseData;

    // Check wallet balance
    const balanceRes = await vigipayClient.get("/api/Wallet/businessWallet");
    const availableBalance =
      balanceRes.data.responseData.availableBalance;

    if (availableBalance < totalAmount) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        availableBalance,
        requiredAmount: totalAmount
      });
    }

    // Create ledger FIRST (idempotent via unique reference later)
    ledger = await walletLedger.create({
      userId: user._id,
      walletId: user.walletId,
      reference: merchantRef, 
      merchantRef,
      type: "DEBIT",
      amount,
      status: "PENDING",
      beneficiaryAccount: accountNumber,
      channel: "vigipay",
      transactionDate: new Date()
    });

    // 🚀 Call provider
    const payoutRes = await vigipayClient.post(
      "/api/Wallet/transfer/account",
      {
        senderWalletId: user.walletId,
        pin,
        amount,
        bankCode,
        accountNumber,
        accountName
      }
    );

    const providerReference =
      payoutRes.data.responseData?.reference;

    // Update ledger with provider reference
    ledger.reference = providerReference;
    ledger.rawWebhookPayload = payoutRes.data;

    ledger.status = "PENDING"; 
    await ledger.save();

    return res.status(200).json({
      message: "Payout initiated successfully",
      merchantRef,
      providerReference,
      data: payoutRes.data
    });

  } catch (error) {
    if (ledger) {
      ledger.status = "FAILED";
      await ledger.save();
    }

    return res.status(500).json({
      message: "Payout failed",
      error: error.response?.data || error.message
    });
  }
};

//payout charges
exports.getPayoutCharge = async (req, res) => {
  try {
    const { amount, transferType = "WalletToAccount" } = req.body;

    const response = await vigipayClient.post("/api/Wallet/charge", {
      amount,
      transferType
    });

    return res.status(200).json({
      message: "Charge retrieved successfully",
      data: response.data.responseData
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to get payout charge",
      error: error.response?.data || error.message
    });
  }
};

//lookup
exports.accountLookup = async (req, res) => {
  try {
    const { bankCode, accNumber } = req.body;

    const response = await vigipayClient.post(
      "/api/Wallet/accountLookup",
      {
        bankCode,
        accNumber
      },
      {
        baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL
      }
    );

    return res.status(200).json({
      message: "Account verified successfully",
      data: response.data.responseData
    });
  } catch (error) {
    return res.status(500).json({
      message: "Account verification failed",
      error: error.response?.data || error.message
    });
  }
};

//banks
exports.getBanks = async (req, res) => {
  try {
    const response = await vigipayClient.get("/api/Wallet/banks", {
      baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL
    });

    return res.status(200).json({
      message: "Banks retrieved successfully",
      data: response.data.responseData
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch banks",
      error: error.response?.data || error.message
    });
  }
};

//get account details 
exports.getAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User does not exist"
      });
    }

    console.log("seller details", user);

    const response = await vigipayClient(
      `/api/VirtualAccount/get?accountId=${user.accountId}`
    );

    // console.log("response", response);

    user.account_Balance =
      response.data.responseData.accountBalance;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Response fetched successfully",
      response: response.data.responseData
    });
  } catch (error) {
    console.error("Error during fetching user account", error);

    return res.status(500).json({
      success: false,
      message: "Error in fetching the account",
      error: error.message
    });
  }
};



exports.walletLedgerController = async(res, req) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if(!user){
      return res.status(400).json({
        success: false,
        message:"User does not exist"
      });
    }
     
    const wallet = await walletLedger.find();
    // console.log("wallet ledger", wallet);
    if(!wallet){
      return res.status(400).json({
        success: false,
        message:"Wallet does not exist"
      });
    }

    return res.status(200).json({
      success: true,
      message:"Wallet fetched successfully",
      walletLedger: wallet
    });

  } catch (error) {
    console.log("Error during fetching wallet ledger");
    return res.status(500).json({
      message:"Error in fetching the account",
      error: error.message
    });
  }
};

exports.payFromStaticWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      recipient_account_number,
      recipient_account_name,
      recipient_bank_code,
      amount,
      narration
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer amount"
      });
    }

    const user = await User.findById(userId);

    if (!user || !user.accountNo) {
      return res.status(404).json({
        success: false,
        message: "Virtual account not found"
      });
    }
    //we are generating refrence to make sure that if the transfer fails we can easily identify the failed transaction and update the ledger accordingly
    const reference = `ADV-${Date.now()}-${user._id}`;

    // fetching balance to validate if the user has sufficient money to transfer or not
    const walletRes = await vigipayClient.get(
      `/api/v2/client/wallet?account_number=${user.accountNo}`
    );

    if (!walletRes.data.status) {
      return res.status(400).json({
        success: false,
        message: walletRes.data.message
      });
    }

    const walletData = walletRes.data.data[0];
    const availableBalance = walletData.availableBalance;

    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
        availableBalance
      });
    }

    // wallet entry with pending status
    const ledger = await walletLedger.create({
      userId: user._id,
      reference,
      type: "DEBIT",
      amount,
      status: "PENDING",
      beneficiaryAccount: recipient_account_number,
      channel: "vigipay",
      transactionDate: new Date()
    });

    // calling api to transfer money
    const transferRes = await vigipayClient.post(
      "/api/v2/client/wallet/transfer",
      {
        sender_account_number: user.accountNo,
        recipient_account_number,
        recipient_account_name,
        recipient_bank_code,
        amount,
        narration,
        reference
      }
    );

    // update ledger
    ledger.status = "SUCCESS";
    ledger.rawWebhookPayload = transferRes.data;
    await ledger.save();

    return res.status(200).json({
      success: true,
      message: "Transfer successful",
      reference,
      data: transferRes.data
    });
  } catch (error) {
    console.error("Static wallet transfer error:", error);

    if (error?.config?.data) {
      try {
        const parsed = JSON.parse(error.config.data);
        if (parsed.reference) {
          await walletLedger.findOneAndUpdate(
            { reference: parsed.reference },
            { status: "FAILED" }
          );
        }
      } catch (e) {
        return e;
      }
    }

    return res.status(500).json({
      success: false,
      message: "Transfer failed",
      error: error.response?.data || error.message
    });
  }
};
