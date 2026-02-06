// import mongoose from 'mongoose';
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken'
// import dotenv from 'dotenv';

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const jwtsecret = process.env.JWT_SECRET;
const saltRounds = 10;

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },

    phone: {
      type: String,
      required: [true, "phone number is required"],
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    otp: {
      type: String,
      select: false,
    },

    // Used across auth controllers (register/login/verify/resend). Keep this field name
    // to match current controller usage (otpExpiry). See: src/controllers/Authentication/auth.js
    otpExpiry: {
      type: Date,
      select: false,
    },

    otpExpires: {
      type: Date,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    kyc_status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    kycVerified: {
      type: Boolean,
      default: false,
    },

    kycVerifiedAt: {
      type: Date,
    },

    kycData: {
      type: mongoose.Schema.Types.Mixed,
    },

    // role: {
    //     type: String,
    //     enum: ['member', 'cooperative_Shopper', 'admin', 'cooperative', 'buyer',
    //         'seller','cooperative_Seller' , 'store_manager', 'logistics_provider'],
    //     default: 'member',
    //     required: false
    // },

    roles: {
      type: [String],
      enum: [
        "buyer",
        "seller",
        "admin",
        "cooperative",
        "member",
        "logistics_provider",
        "cooperative_admin",
      ],
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended", "invited"],
      default: "active",
    },

    invitationToken: {
      type: String,
      select: false,
    },

    invitationExpires: {
      type: Date,
      select: false,
    },

    refreshToken: {
      type: String,
      select: false,
    },

    verificationToken: {
      type: String,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
    },
    walletId: {
      type: String,
    },
    accountId: {
      type: String,
    },
    accountNo: {
      type: String,
    },
    pin: {
      type: String,
      select: false,
    },
    accountName: {
      type: String,
    },
    bankName: {
      type: String,
    },
    bankCode: {
      type: String,
    },
    aacount_Balance: {
      type: Number,
    },
    wallet_balance: {
      type: Number,
    }

  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (Enteredpassword) {
  return await bcrypt.compare(Enteredpassword, this.password);
};

UserSchema.methods.generateToken = async function () {
  const accessToken = jwt.sign(
    {
      _id: this._id,
      firstName: this.firstName,
      email: this.email,
      roles: this.roles,
      status: this.status,
      shop: this.shop,
    },
    jwtsecret,
    {
      expiresIn: "1d",
    }
  );

  const refreshToken = jwt.sign({ _id: this._id }, jwtsecret, {
    expiresIn: "15d",
  });

  return { accessToken, refreshToken };
};

// UserSchema.methods.generateRefreshToken = async function(){
// return jwt.sign(
//     {_id: this._id},
//     jwtsecret,
//     {
//         expiresIn : "15d"
//     }
// )
// }

const user = mongoose.model("User", UserSchema);
module.exports = user;
