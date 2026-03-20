const mongoose = require("mongoose");

const logisticsProviderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    businessName: { type: String, required: true },
    phone: { type: String },
    vehicleType: {
      type: String,
      enum: ["bike", "van", "truck", "car"],
      default: "van",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

const LogisticsProvider = mongoose.model(
  "LogisticsProvider",
  logisticsProviderSchema
);

module.exports = LogisticsProvider;
