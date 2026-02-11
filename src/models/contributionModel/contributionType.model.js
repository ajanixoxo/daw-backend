const mongoose = require("mongoose");

const ContributionTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      enum: ["recurring", "target-based", "investment", "one-time"],
      required: true
    },

    frequency: {
      type: String,
      enum: ["daily", "weekly", "bi-weekly", "monthly", "quarterly", "annually", "n/a"],
      default: "monthly"
    },

    amount: {
      type: Number,
      required: true
    },

    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true
    },

    loanEligibilityMonths: {
      type: Number,
      default: 3
    },

    status: {
      type: String,
      enum: ["active", "pending", "rejected"],
      default: "pending"
    },

    memberCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Unique name per cooperative
ContributionTypeSchema.index({ name: 1, cooperativeId: 1 }, { unique: true });

const ContributionType = mongoose.model("ContributionType", ContributionTypeSchema);
module.exports = ContributionType;
