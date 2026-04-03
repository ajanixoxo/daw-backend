const asyncHandler = require("express-async-handler");
const sendEmail  = require("@utils/SendEmail/email.js");

const verificationEmailTemplate = asyncHandler(async(email, firstName, otp) => {
  const subject = "Email Verification Code - Digital African Women";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Dear ${firstName},</p>
      <p>Thank you for registering with DAW! Please use this OTP to verify your email address:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block;">${otp}</h3>
      <p>This OTP is valid for 10 minutes only. If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("Verification email sent to:", email);
});

const loginOTPEmailTemplate = asyncHandler(async(email, firstName, otp) => {
  const subject = "Login OTP - Digital African Women";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Login OTP</h2>
      <p>Dear ${firstName},</p>
      <p>Please use this OTP to complete your login:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block;">${otp}</h3>
      <p>This OTP is valid for 10 minutes only. If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("Login OTP email sent to:", email);
});

const forgotPasswordOTPEmailTemplate = asyncHandler(async(email, firstName, otp) => {
  const subject = "Forgot password OTP - Digital African Women";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Login OTP</h2>
      <p>Dear ${firstName},</p>
      <p>Please use this OTP to reset your password:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block;">${otp}</h3>
      <p>This OTP is valid for 10 minutes only. If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("forgot password OTP email sent to:", email);
});
const deliveryAssignedEmailTemplate = asyncHandler(async(email, name, orderId) => {
  const subject = "New Delivery Order Assigned - Digital African Women";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">New Delivery Assigned</h2>
      <p>Dear ${name},</p>
      <p>A new order has been placed and assigned to you for delivery. The Shipment ID is:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block;">${orderId}</h3>
      <p>Please log in to your logistics dashboard to view the delivery details and update its status.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("New delivery email sent to:", email);
});

const orderStatusBuyerEmailTemplate = asyncHandler(async(email, name, orderId, newStatus) => {
  const subject = `Order Status Update: ${newStatus.replace('_', ' ')} - Digital African Women`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Order Status Updated</h2>
      <p>Dear ${name},</p>
      <p>The status of your order (ID: <strong>${orderId}</strong>) has been updated to:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block; text-transform: uppercase;">${newStatus.replace('_', ' ')}</h3>
      <p>Log in to your dashboard to view more details.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("Order status (buyer) email sent to:", email);
});

const orderStatusSellerEmailTemplate = asyncHandler(async(email, name, orderId, newStatus) => {
  const subject = `Order Status Update: ${newStatus.replace('_', ' ')} - Digital African Women`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Order Status Updated</h2>
      <p>Dear ${name},</p>
      <p>An order from your shop (ID: <strong>${orderId}</strong>) has had its delivery status updated to:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block; text-transform: uppercase;">${newStatus.replace('_', ' ')}</h3>
      <p>Log in to your seller dashboard to view more details.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("Order status (seller) email sent to:", email);
});

module.exports ={
  verificationEmailTemplate,
  loginOTPEmailTemplate,
  forgotPasswordOTPEmailTemplate,
  deliveryAssignedEmailTemplate,
  orderStatusBuyerEmailTemplate,
  orderStatusSellerEmailTemplate
};