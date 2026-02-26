import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { Request, Response } from "express";
import mongoose from "mongoose";
import Due from "../models/Due";
import Payment from "../models/Payment";
import { initializeFlutterwave } from "../services/flutterwave";
import { updatePayoutOnSuccess } from "../controllers/payoutController";
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
  let subaccounts: any[] = [];

  if (due.flutterwaveSubaccountId) {
    // Buffer to cover Flutterwave fees/VAT/stamp (usually ₦50–150 is enough)
  
    const safeExtraCharge = Math.min(extraCharge, totalAmount - 1);

const mainSharePercent = (extraCharge / totalAmount) * 100;

subaccounts = [
  {
    id: due.flutterwaveSubaccountId,
    transaction_charge_type: "percentage",
    transaction_charge: mainSharePercent,
  }
];
    
console.log("SPLIT DEBUG:", {
  baseAmount,
  extraCharge,
  totalAmount,
  transactionChargeKobo: extraCharge * 100
});
    console.log("SUBACCOUNT SPLIT (FIXED & BUFFERED):", {
      subaccountId: due.flutterwaveSubaccountId,
      type: "flat → you receive fixed with buffer",
      expectedToSubaccount: baseAmount,
      totalPaidByStudent: totalAmount
    });
  } else {
    console.warn("No subaccount ID found for due:", due.name);
  }

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
    subaccounts: subaccounts
  };

  const flwRes = await initializeFlutterwave(flwPayload);
  paymentUrl = flwRes.data.link;
}
else {
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
      association: due.name,
      metadata,
      userId: req.user ? req.user.id : null,
    });

   await payment.save();
console.log("New payment created with metadata:", payment.metadata);

    res.json({ status: "success", paymentUrl, reference });
  } catch (err: any) {
    console.error("INIT ERROR:", err);
    res.status(500).json({ message: "Payment initialization failed" });
  }
};

export const verifyFlutterwavePayment = async (req: Request, res: Response) => {
  const { reference } = req.params;  // tx_ref

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const data = response.data;

    if (data.status !== "success" || data.data.status !== "successful") {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=verification_failed`);
    }

    const tx = data.data;

    // Find and update payment
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      console.warn(`Payment not found for ref ${reference} after Flutterwave verify`);
      return res.redirect(`${process.env.FRONTEND_URL}/payment-success?reference=${reference}&warning=not_found`);
    }

    payment.status = "success";
    payment.paidAt = new Date(tx.charged_at || Date.now());
    payment.amount = tx.amount;

    if (tx.amount !== payment.amount) {
  console.error("Amount mismatch!");
  return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=amount_mismatch`);
}

    // Merge any extra meta if needed (Flutterwave returns your original meta)
    payment.metadata = {
  ...payment.metadata,
  flutterwaveTxId: tx.id,
  chargedAmount: tx.charged_amount,
  processorFee: tx.app_fee || tx.fee,
  amountSettled: tx.amount_settled,
};

    await payment.save();

// Generate PDF buffer in memory (don't save to disk)
const PDFDocument = require('pdfkit');
const doc = new PDFDocument();
const buffers: Buffer[] = [];

doc.on('data', buffers.push.bind(buffers));
doc.on('end', async () => {
  const pdfBuffer = Buffer.concat(buffers);

  // Send email
  if (payment.email) {
    await sendReceiptEmail(payment.email, payment.reference, pdfBuffer);
  }
});

doc.fontSize(20).text('SwiftPay Receipt', { align: 'center' });
doc.moveDown();
doc.fontSize(14).text(`Reference: ${payment.reference}`);
doc.text(`Name: ${payment.metadata?.payerName || 'N/A'}`);
doc.text(`Matric: ${payment.metadata?.matricNumber || 'N/A'}`);
// ... add all other fields like before
doc.end();

    console.log(`Flutterwave payment verified & saved: ${reference}`);

    // Optional: update payout
    const dueId = payment.metadata?.dueId;
    if (dueId && payment.metadata?.baseAmount) {
      await updatePayoutOnSuccess(dueId, payment.metadata.baseAmount);
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/payment-success?reference=${reference}&status=success`
    );
  } catch (err: any) {
    console.error("Flutterwave verify error:", err.response?.data || err.message);
    return res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
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

   // After await payment.save();
console.log("Payment saved successfully:", {
  reference: reference,
  status: payment.status,
  dueId: payment.metadata?.dueId,
  baseAmount: payment.metadata?.baseAmount,
  metadata: payment.metadata
});

// NEW: Update payout record
const dueId = payment.metadata?.dueId;
const baseAmount = payment.metadata?.baseAmount || 0;

console.log("Trying to update payout:", { dueId, baseAmount });

if (dueId && baseAmount > 0) {
  try {
    await updatePayoutOnSuccess(dueId, baseAmount);
    console.log(`Payout updated for due ${dueId}: +₦${baseAmount}`);
  } catch (err) {
    console.error("Payout update FAILED:", err);
  }
} else {
  console.warn("No payout update - missing dueId or baseAmount");
}

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
    const userId = req.user.id; // must exist since ProtectedRoute + authMiddleware

    const payments = await Payment.find({
      userId: userId,           // ← payments I initiated
      status: "success",
    })
      .sort({ paidAt: -1 })
      .lean();

    res.json(payments);
  } catch (err) {
    console.error("getMyPayments error:", err);
    res.status(500).json({ message: "Failed to load your transactions" });
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
  const { q, levels } = req.query;

  try {
    let filter: any = { status: "success" };

    if (q) {
      filter.$or = [
        { "metadata.matricNumber": { $regex: q, $options: "i" } },
        { "metadata.payerName": { $regex: q, $options: "i" } },
        { "metadata.dueName": { $regex: q, $options: "i" } },
        { "metadata.level": { $regex: q, $options: "i" } }
      ];
    }

    if (levels) {
      const levelArray = (levels as string).split(",");
      filter["metadata.level"] = { $in: levelArray };
    }

    const payments = await Payment.find(filter).sort({ paidAt: -1 });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


console.log("✅ PaymentController loaded (Paystack + Flutterwave)");

// Flutterwave Bank List & Verification
export const getBanks = async (req: Request, res: Response) => {
  try {
    console.log("Using FLW key:", process.env.FLUTTERWAVE_SECRET_KEY ? "YES (hidden)" : "NO - MISSING");
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error("FLUTTERWAVE_SECRET_KEY is not set in environment!");
      return res.status(500).json({ message: "Server configuration error: Missing Flutterwave key" });
    }

    const response = await axios.get("https://api.flutterwave.com/v3/banks/NG", {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
    });
    res.json(response.data.data); // returns array of { code, name }
  } catch (err: any) {
    console.error("Get banks error:", err);
    res.status(500).json({ message: "Failed to fetch banks" });
  }
};

export const verifyAccountName = async (req: Request, res: Response) => {
  const { accountNumber, bankCode } = req.body;

  if (!accountNumber || !bankCode) {
    return res.status(400).json({ message: "Account number and bank code required" });
  }

  try {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error("FLUTTERWAVE_SECRET_KEY is not set in environment!");
      return res.status(500).json({ message: "Server configuration error: Missing Flutterwave key" });
    }
    const response = await axios.post(
      "https://api.flutterwave.com/v3/accounts/resolve",
      { account_number: accountNumber, account_bank: bankCode },
      { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
    );

    if (response.data.status === "success") {
      res.json({ accountName: response.data.data.account_name });
    } else {
      res.status(400).json({ message: "Invalid account details" });
    }
  } catch (err: any) {
    console.error("Verify account error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

export const confirmPayment = async (req: Request & { user?: { id: string } }, res: Response) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  if (payment.confirmed) {
    return res.json({ message: "Already confirmed" });
  }

 if (!req.user?.id) {
  return res.status(401).json({ message: "Unauthorized" });
}

payment.confirmed = true;
payment.confirmedAt = new Date();
payment.confirmedBy = new mongoose.Types.ObjectId(req.user.id);


await payment.save();

  res.json({ success: true, payment });
};


/* =====================================================
   GET PAYMENT STATUS (FOR FRONTEND)
===================================================== */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ reference });

    if (!payment) {
      return res.status(404).json({ status: "not_found" });
    }

    return res.json({
      status: payment.status, // success | pending | failed
      reference: payment.reference,
      amount: payment.amount,
      baseAmount: payment.metadata?.baseAmount || 0,
    });
  } catch (err) {
    console.error("GET PAYMENT STATUS ERROR:", err);
    res.status(500).json({ status: "error" });
  }
};
export const getPayments = async (req: Request, res: Response) => {
  const { levels } = req.query;

  let filter: any = {
    status: "success"  // VERY IMPORTANT
  };

  if (levels) {
    const levelArray = (levels as string).split(",");
    filter["metadata.level"] = { $in: levelArray };
  }

  const payments = await Payment.find(filter).sort({ paidAt: -1 });

  res.json(payments);
};

function sendReceiptEmail(email: string, reference: string, pdfBuffer: Buffer<ArrayBuffer>) {
  throw new Error("Function not implemented.");
}

