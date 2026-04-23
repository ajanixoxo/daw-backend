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
const deliveryAssignedEmailTemplate = asyncHandler(async (email, name, orderId, items, shopName, sellerName, sellerPhone, pickupAddress) => {
  const subject = "New Delivery Order Assigned - Digital African Women";
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_id?.name || 'Product'}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #F10E7C; text-align: center;">New Delivery Assigned</h2>
      <p>Dear ${name},</p>
      <p>A new order has been placed and assigned for delivery. Please find the pickup and product details below:</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <p style="margin: 0;"><strong>Shipment ID:</strong> ${orderId}</p>
        <p style="margin: 5px 0 0 0;"><strong>Shop Name:</strong> ${shopName || 'N/A'}</p>
        <p style="margin: 5px 0 0 0;"><strong>Seller:</strong> ${sellerName || 'N/A'} (${sellerPhone || 'N/A'})</p>
        <p style="margin: 5px 0 0 0;"><strong>Pickup Address:</strong> ${pickupAddress || 'N/A'}</p>
      </div>

      <h4 style="margin-bottom: 10px;">Items to Pickup:</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p>Please log in to your logistics dashboard to view the full routing details and update the status.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://digitalafricanwomen.com/logistics/deliveries" style="background-color: #F10E7C; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
      </div>
      <p style="margin-top: 30px; border-top: 1px solid #eee; pt: 20px; font-size: 12px; color: #777;">
        Best regards,<br/>The Digital African Women Team
      </p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("New delivery email sent to:", email);
});

const orderReceivedSellerEmailTemplate = asyncHandler(async (email, name, orderId, buyerName, items) => {
  const subject = "New Order Received! - Digital African Women";
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_id?.name || 'Product'}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2ba570; text-align: center;">You have a new order!</h2>
      <p>Dear ${name},</p>
      <p>Congratulations! An order has been placed for items in your shop by <strong>${buyerName}</strong>.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <p style="margin: 0;"><strong>Order ID:</strong> ${orderId}</p>
      </div>

      <h4 style="margin-bottom: 10px;">Items Ordered:</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p>Please prepare these items for pickup. A logistics provider has been notified and will be in contact shortly.</p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://digitalafricanwomen.com/seller/orders" style="background-color: #2ba570; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Manage Order</a>
      </div>
      
      <p style="margin-top: 30px; border-top: 1px solid #eee; pt: 20px; font-size: 12px; color: #777;">
        Best regards,<br/>The Digital African Women Team
      </p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("New order (seller) email sent to:", email);
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
  orderReceivedSellerEmailTemplate,
  orderStatusBuyerEmailTemplate,
  orderStatusSellerEmailTemplate
};