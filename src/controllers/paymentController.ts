import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { Request, Response } from "express";
import Due from "../models/Due";
import Payment from "../models/Payment";
import { initializeFlutterwave } from "../services/flutterwave";

/* =====================================================
   PAYSTACK — INITIALIZE PAYMENT
===================================================== */
export const initializePayment = async (
  req: Request & { user?: { id: string; email?: string } },
  res: Response
) => {
  console.log("INIT BODY:", req.body);

  try {
    const { email, dueId, level, name, matric, department, phone, gateway = "flutterwave" } = req.body;

    if (!email || !dueId || !level) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const due = await Due.findById(dueId);
    if (!due) {
      return res.status(404).json({ message: "Due not found" });
    }

    const prices = typeof (due.prices as any)?.toObject === "function"
      ? (due.prices as any).toObject()
      : (due.prices as any);

    const levelKey = String(level).trim();
    const baseAmount = prices instanceof Map ? prices.get(levelKey) : (prices as any)[levelKey];

    if (typeof baseAmount !== "number" || baseAmount <= 0) {
      return res.status(400).json({
        message: `Invalid amount for level "${levelKey}" in due "${due.name}"`,
        availableLevels: prices instanceof Map ? Array.from(prices.keys()) : Object.keys(prices),
      });
    }

    const extraCharge = due.extraCharge || 0;
    let platformCommission = 0;
    if (extraCharge === 0) {
      const platformFeePercent = due.platformFeePercent || 7;
      platformCommission = (baseAmount * platformFeePercent) / 100;
    }

    const totalAmount = baseAmount + platformCommission + extraCharge;

    const metadata = {
      payerName: name,
      matricNumber: matric,
      department,
      phone,
      level: levelKey,
      dueId: due._id,
      dueName: due.name,
      baseAmount,
      platformCommission,
      extraCharge,
      gateway,
    };

    let paymentUrl: string;
    const reference = `SWIFT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (gateway === "flutterwave") {
      const flwPayload = {
        tx_ref: reference,
        amount: totalAmount,
        currency: "NGN",
        redirect_url: `${process.env.FRONTEND_URL}/payment-success`,
        customer: {
          email,
          name,
          phone_number: phone,
        },
        customizations: {
          title: `SwiftPay - ${due.name}`,
          description: `Payment for ${due.name} - Level ${level}`,
        },
        meta: metadata,
      };

      const flwRes = await initializeFlutterwave(flwPayload);
      paymentUrl = flwRes.data.link;
    } else {
      // Fallback to Paystack (old code)
      const paystackRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: Math.round(totalAmount * 100),
          metadata,
          callback_url: `${process.env.FRONTEND_URL}/payment-success`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      paymentUrl = paystackRes.data.data.authorization_url;
    }

    const payment = new Payment({
      reference,
      amount: totalAmount,
      email,
      status: "pending",
      metadata,
      userId: req.user ? req.user.id : null,
    });

    await payment.save();

    res.json({ status: "success", paymentUrl, reference });
  } catch (err: any) {
    console.error("INIT ERROR:", err);
    res.status(500).json({ message: "Payment initialization failed" });
  }
};

/* =====================================================
   PAYSTACK — VERIFY PAYMENT
===================================================== */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    // 1️⃣ Verify from Paystack
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = paystackRes.data.data;

    if (data.status !== "success") {
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment-failed`
      );
    }

    // 2️⃣ Find existing payment (created during initialize)
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // 3️⃣ Update explicitly
    payment.status = "success";
    payment.paidAt = new Date(data.paid_at);
    payment.amount = data.amount / 100;

    // ⚠️ MERGE metadata, don’t overwrite
    payment.metadata = {
      ...payment.metadata,
      ...data.metadata,
    };

    await payment.save();

    // 4️⃣ REDIRECT (THIS FIXES EVERYTHING)
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment-success?reference=${reference}`
    );
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    return res.status(500).json({ message: "Verification failed" });
  }
};

/* =====================================================
   GET USER PAYMENTS
===================================================== */
export const getMyPayments = async (req: any, res: Response) => {
  try {
    const payments = await Payment.find({
      $or: [{ userId: req.user.id }, { email: req.user.email }],
      status: "success",
    }).sort({ paidAt: -1 });

    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET ALL PAYMENTS (ADMIN)
===================================================== */
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const payments = await Payment.find().sort({ paidAt: -1 });
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   SEARCH PAYMENTS (ADMIN)
===================================================== */
export const searchPayments = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    const payments = await Payment.find({
      $or: [
        { dueName: { $regex: q, $options: "i" } },
        { "metadata.payerName": { $regex: q, $options: "i" } },
      ],
      status: "success",
    }).sort({ paidAt: -1 });

    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

console.log("✅ PaymentController loaded (Paystack only)");
