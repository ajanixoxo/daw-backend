const user = require("@models/userModel/user.js");
const asyncHandler = require("express-async-handler");
const AppError = require("@utils/Error/AppError.js");
const {
  verificationEmailTemplate,
  loginOTPEmailTemplate,
} = require("@utils/EmailTemplate/template.js");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const registerUser = asyncHandler(async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      phone,
      roles,
    } = req.body;

    if (!firstName || !email || !password || !phone || !roles) {
      throw new AppError("All fields are required", 400);
    }

    if (password !== confirmPassword) {
      throw new AppError("Passwords must match", 400);
    }

    const existingUser = await user.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        message: "user already exist",
      });
    }

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const newUser = await user.create({
      firstName,
      lastName,
      email,
      password,
      isVerified:false,
      phone,
      roles,
      otp,
      otpExpiry,
    });

    await verificationEmailTemplate(newUser.email, newUser.firstName, otp);

    const token = jwt.sign(
      { _id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "15min" }
    );
    res.status(201).json({
      success: true,
      message: "Successfully registered. OTP sent to email for verification.",
      token: token,
      user: {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        verified: newUser.isVerified,
        roles: newUser.roles,
      },
    });
  } catch (error) {
    console.error("Error in registering user:", error);

    let errorMsg = error?.errors
      ? Object.values(error.errors)
          .map((err) => err.message)
          .join(", ")
      : error.message;

    return res.status(400).json({
      success: false,
      status: "error",
      message: errorMsg || "Error during register user",
    });
  }
});

const verifyEmail = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    const User = await user.findById(userId).select("+otp +otpExpiry");
    if (!User) return next(new AppError("Invalid user", 400));

    if (User.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }
    
    if (User.otp !== otp) {
      return next(new AppError("Invalid OTP", 400));
    }

    if (User.otpExpiry < Date.now()) {
      return next(new AppError("OTP expired. Please request a new one.", 400));
    }

    User.isVerified = true;
    User.otp = null;
    User.otpExpiry = null;
    await User.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    return next(error);
  }
});

const resendEmailVerificationOTP = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) throw new AppError("Email is required", 400);

    const User = await user.findOne({ email });
    if (!User) throw new AppError("User not found", 404);

    if (User.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    User.otp = otp;
    User.otpExpiry = Date.now() + 10 * 60 * 1000;

    await User.save();
    await verificationEmailTemplate(email, User.firstName, otp);

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error in resendLink:", error);
    throw new AppError("Internal server error", 500);
  }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const existingUser = await user.findOne({ refreshToken });
    if (!existingUser) {
      throw new AppError("Invalid refresh token", 401);
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const User = await user.findById(decoded._id);

    if (!User) {
      return res.status(400).json({
        message: "user already exist",
      });
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await User.generateToken();
    User.refreshToken = newRefreshToken;
    await User.save();

    res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      token: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error("Error in refreshing access token:", error);
    throw new AppError("Internal server error", 500);
  }
});

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const User = await user.findOne({ email }).select("+password");
    if (!User) return res.status(404).json({ message: "User not found" });

    const isMatched = await User.comparePassword(password);
    if (!isMatched) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (!User.isVerified) {
      return res.status(400).json({ message: "Please verify your email" });
    }

    const otp = generateOTP();
    User.otp = otp;
    User.otpExpiry = Date.now() + 10 * 60 * 1000;
    await User.save();

    await loginOTPEmailTemplate(email, User.firstName, otp);

    const TempToken = jwt.sign(
      { _id: User._id, email: User.email },
      JWT_SECRET,
      { expiresIn: "15min" }
    );

    User.password = undefined;
    User.otp = undefined;
    User.otpExpiry = undefined;

    res.status(200).json({
      message: "OTP sent to email. Please verify OTP to complete login.",
      user: User,
      token: TempToken,
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function loginOTP(req, res) {
  try {
    const userId = req.user._id;
    const { otp } = req.body || {};
    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }
    const User = await user.findOne({ _id: userId }).select("+otp +otpExpiry");
    if (!User) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    if (User.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    if (User.otpExpiry < Date.now()) {
      return res
        .status(400)
        .json({ error: "OTP expired. Please request a new one." });
    }

    const { accessToken, refreshToken } = await User.generateToken();
    User.otp = null;
    User.otpExpiry = null;
    await User.save();

    User.password = undefined;

    res.json({
      message: "Login successful",
      token: {
        accessToken,
        refreshToken,
      },
      user: User,
    });
  } catch (error) {
    console.error("Error in verifying OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  registerUser,
  verifyEmail,
  resendEmailVerificationOTP,
  refreshAccessToken,
  login,
  loginOTP,
};
