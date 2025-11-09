// import { sendEmail } from '../SendEmail/email.js';
// import asyncHandler from 'express-async-handler';
const asyncHandler = require('express-async-handler');
const sendEmail  = require("@utils/sendEmail/email.js")

const verificationEmailTemplate = asyncHandler(async(email, firstName, link) => {
  const subject = "Email Verification Code - Digital African Women";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Dear ${firstName},</p>
      <p>Thank you for registering with DAW! Please click this verification link to verify your email address:</p>
      <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block;"><a href="${link}" style="color:blue; text-decoration:underline;">
            Verify Email
        </a></h3>
      <p>This Link is valid for the next 12 hours. If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>The Digital African Women Team</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log("Verification email sent to:", email);
});

module.exports ={
  verificationEmailTemplate
}