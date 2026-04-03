const Newsletter = require("../models/newsletterModel");
const AppError = require("../utils/Error/AppError");

exports.subscribe = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    // Check if already subscribed
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      return res.status(400).json({
        success: false,
        message: "This email is already subscribed to our newsletter."
      });
    }

    const newSubscriber = await Newsletter.create({ email });

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to our newsletter!",
      data: newSubscriber
    });
  } catch (error) {
    next(error);
  }
};
