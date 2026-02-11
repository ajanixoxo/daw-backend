// import nodemailer from "nodemailer";
// import dotenv from "dotenv";

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: "DAW",
    to,
    subject,
    html
  });
};
module.exports = sendEmail;