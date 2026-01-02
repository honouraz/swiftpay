import crypto from "crypto";
import { Response } from "express";
import Payment from "../models/Payment";
import User from "../models/User";

export const paystackWebhook = async (req: any, res: Response) => {
  try {
    const raw = req.rawBody;
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

      // Find user by email for userId
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
          userId,  // Add here
        },
        { new: true, upsert: true }
      );

      console.log("✅ PAYSTACK PAYMENT SAVED:", payment.reference);
    }
  } catch (err: any) {
    console.error("❌ WEBHOOK ERROR:", err.message);
  }

  res.sendStatus(200);
};