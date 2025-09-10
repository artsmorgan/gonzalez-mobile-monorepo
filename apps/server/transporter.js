// email.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Transporter con Gmail (recomendado usar app password, no la clave normal)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

export { transporter };
