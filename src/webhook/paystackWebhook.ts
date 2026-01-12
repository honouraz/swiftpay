import crypto from "crypto";
import Payment from "../models/Payment";
import User from "../models/User";
import Conversation from "../models/conversation"; // Add this import
import twilio from "twilio"; // Add this import
import { Request, Response } from "express";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const paystackWebhook = async (req: Request & { body: Buffer }, res: Response) => {
  try {
    const raw = req.body;
    const secret = process.env.PAYSTACK_SECRET_KEY!;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(raw)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.log("❌ Invalid Paystack signature");
      return res.sendStatus(401);
    }

    const event = JSON.parse(raw.toString());

    if (event.event === "charge.success") {
      const d = event.data;
      const meta = d.metadata || {};

      const baseAmount = Number(meta.baseAmount || 0);
      const platformCommission = Number(meta.platformCommission || 0);
      const extraCharge = Number(meta.extraCharge || 0);

      const totalAmount = d.amount / 100;

      let userId = null;
      const user = await User.findOne({ email: d.customer.email });
      if (user) userId = user._id;

      const payment = await Payment.findOneAndUpdate(
        { reference: d.reference },
        {
          status: "success",
          email: d.customer.email,
          payerName: meta.payerName || "",
          matricNumber: meta.matricNumber || "",
          department: meta.department || "",
          phone: meta.phone || "",
          level: meta.level || "",
          dueId: meta.dueId || null,
          dueName: meta.dueName || "SwiftPay Payment",
          baseAmount,
          platformCommission,
          extraCharge,
          amount: totalAmount,
          paidAt: new Date(d.paid_at),
          metadata: meta,
          userId,
        },
        { new: true, upsert: true }
      );

      console.log("✅ PAYSTACK PAYMENT SAVED:", payment.reference);

      // Send text receipt via WhatsApp (safe, no PDF issues yet)
      // NEW: Try to find matching WhatsApp conversation & send receipt
try {
  const waConv = await Conversation.findOne({
    "data.reference": d.reference,
    currentStep: "payment_pending"
  });

  if (waConv) {
    const receiptMessage = 
      `🎉 PAYMENT CONFIRMED!\n\n` +
      `Receipt for: ${payment.dueName || "Dues Payment"}\n` +  // ← safe fallback
      `Amount: ₦${payment.amount.toLocaleString()}\n` +
      `Payer: ${payment.payerName || "N/A"}\n` +
      `Matric: ${payment.matricNumber || "N/A"}\n` +
      `Reference: ${payment.reference}\n\n` +
      `Thank you for using SwiftPay!`;

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER!,
      to: `whatsapp:+${waConv.waId}`,
      body: receiptMessage
    });

    console.log(`✅ Receipt text sent to ${waConv.waId}`);

    // Reset conversation
    waConv.currentStep = "idle";
    waConv.data = {};
    await waConv.save();
  }
} catch (receiptErr: any) {
  console.error("Receipt send error:", receiptErr.message);
}
    }
  } catch (err: any) {
    console.error("❌ WEBHOOK ERROR:", err.message);
  }

  res.sendStatus(200);
};