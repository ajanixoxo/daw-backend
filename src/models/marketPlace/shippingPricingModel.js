const mongoose = require('mongoose');

const shippingPricingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['national', 'international'],
      required: true,
    },
    
    // --- National pricing fields ---
    minWeight: {
      type: Number,
      required: function () { return this.type === 'national'; },
    },
    maxWeight: {
      type: Number,
      required: function () { return this.type === 'national'; },
    },
    pickupFee: {
      type: Number,
    },
    deliveryFee: {
      type: Number,
    },
    freightFee: {
      type: Number,
    },
    perKgRate: {
      type: Number,
    },
    regionType: {
      type: String,
      enum: ['north', 'general'],
      required: function () { return this.type === 'national'; },
    },

    // --- International pricing fields ---
    weight: {
      type: Number,
      required: function () { return this.type === 'international'; },
    },
    prices: {
      usa: Number,
      canada: Number,
      uk: Number,
      europe: Number,
      australia: Number,
      asia: Number,
      westAfrica: Number,
      restOfAfrica: Number,
      farEuropeUAE: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ShippingPricing || mongoose.model('ShippingPricing', shippingPricingSchema);
