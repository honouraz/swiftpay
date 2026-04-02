import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendReceiptEmail = async (email: string, reference: string, pdfBuffer: Buffer) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not set. Skipping email sending.');
    return;
  }

  const mailOptions = {
    from: `"SwiftPay" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your SwiftPay Receipt - ${reference}`,
    text: `Hello, your payment with reference ${reference} was successful. Please find your receipt attached.`,
    attachments: [
      {
        filename: `SwiftPay_Receipt_${reference}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send receipt email:', err);
  }
};