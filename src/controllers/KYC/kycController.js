const user = require("@models/userModel/user.js");
const asyncHandler = require("express-async-handler");
const AppError = require("@utils/Error/AppError.js");
const axios = require("axios");
const mongoose = require("mongoose");

/**
 * Verify NIN with YouVerify
 * POST /kyc/verify-nin
 */
const verifyNIN = asyncHandler(async (req, res) => {
  try {
    const { userId, nin, firstName, lastName, dateOfBirth, selfieImage } = req.body;

    // Validate required fields
    if (!nin) {
      throw new AppError("nin is required", 400);
    }

    // userId is required in the request body
    const targetUserId = userId;
    
    console.log("KYC Verification - userId from body:", userId);
    console.log("KYC Verification - targetUserId:", targetUserId);
    
    if (!targetUserId) {
      throw new AppError("userId is required", 400);
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new AppError(`Invalid userId format: ${targetUserId}`, 400);
    }

    // Find user
    const User = await user.findById(targetUserId);
    if (!User) {
      console.error(`User not found with ID: ${targetUserId}`);
      throw new AppError(`User not found with ID: ${targetUserId}`, 404);
    }
    
    console.log("KYC Verification - User found:", User._id, User.email);

    // Prepare payload for YVOS API
    const payload = {
      id: nin,
      isSubjectConsent: true,
      premiumNin: false
    };

    // Add optional fields if provided
    if (firstName) {payload.firstName = firstName;}
    if (lastName) {payload.lastName = lastName;}
    if (dateOfBirth) {payload.dateOfBirth = dateOfBirth;}
    if (selfieImage) {
      payload.selfie = {
        image: selfieImage
      };
    }

    // Call YVOS API
    const baseUrl = process.env.BASE_URL || "https://api.sandbox.youverify.co";
    const apiKey = process.env.YVOS_API_KEY;

    if (!apiKey) {
      throw new AppError("YVOS_API_KEY is not configured", 500);
    }

    const response = await axios.post(
      `${baseUrl}/v2/api/identity/ng/nin`,
      payload,
      {
        headers: {
          token: apiKey,
          "Content-Type": "application/json"
        }
      }
    );

    // Parse response
    const responseData = response.data;
    const isSuccess = responseData.success === true;
    const data = responseData.data || {};
    const status = data.status;
    const allValidationPassed = data.allValidationPassed === true;

    // Update user based on response
    if (isSuccess && status === "found" && allValidationPassed) {
      User.kycVerified = true;
      User.kycVerifiedAt = new Date();
      User.kycData = data;
      
      // Also update kyc_status for backward compatibility
      if (User.kyc_status !== "verified") {
        User.kyc_status = "verified";
      }
    } else {
      User.kycVerified = false;
      User.kycData = data;
      
      // Update kyc_status based on status
      if (status === "found" && !allValidationPassed) {
        User.kyc_status = "rejected";
      } else {
        User.kyc_status = "pending";
      }
    }

    await User.save();

    // Return response
    return res.status(200).json({
      success: isSuccess,
      kycVerified: User.kycVerified,
      data: responseData
    });

  } catch (error) {
    console.error("Error verifying NIN:", error.message);
    
    // Handle axios errors
    if (error.response) {
      // YVOS API returned an error response
      return res.status(error.response.status || 500).json({
        success: false,
        kycVerified: false,
        error: error.response.data || error.message
      });
    }
    
    // Handle other errors
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(error.message || "Error verifying NIN", error.statusCode || 500);
  }
});

module.exports = {
  verifyNIN
};

