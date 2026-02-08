// controllers/payoutController.ts
import { Request, Response } from "express";
import Payout from "../models/Payout";
import Due from "../models/Due";
import Payment from "../models/Payment";
import axios from "axios";
import SubAdmin from "../models/SubAdmin";

// Auto-update payout when payment succeeds (call this in verifyPayment or webhook)
export const updatePayoutOnSuccess = async (dueId: string, baseAmount: number) => {
  const due = await Due.findById(dueId);
  if (!due) return;

  await Payout.findOneAndUpdate(
    { dueId },
    { 
      $inc: { 
        totalCollectedBase: baseAmount,
        pendingAmount: baseAmount 
      },
      associationName: due.name,
      $setOnInsert: { lastPayoutDate: new Date() }
    },
    { upsert: true, new: true }
  );
};

// GET /api/payouts/all (admin only)
export const getAllPayouts = async (req: Request, res: Response) => {
  try {
    const payouts = await Payout.find()
      .populate("dueId", "name bankName accountNumber accountName")
      .sort({ updatedAt: -1 });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payouts" });
  }
};

// GET /api/payouts/my (subadmin)
export const getMyPayout = async (req: any, res: Response) => {
  try {
    const subadmin = await SubAdmin.findById(req.user.id);
    if (!subadmin?.association) return res.status(400).json({ message: "No association linked" });

    const due = await Due.findOne({ name: subadmin.association });
    if (!due) return res.status(404).json({ message: "Due not found" });

    const payout = await Payout.findOne({ dueId: due._id }) || {
      totalCollectedBase: 0,
      totalPaidOut: 0,
      pendingAmount: 0,
      payouts: []
    };

    res.json({
      totalCollectedBase: payout.totalCollectedBase,
      totalPaidOut: payout.totalPaidOut,
      pendingAmount: payout.pendingAmount,
      payouts: payout.payouts
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/payouts/initiate/:dueId (admin only)
export const initiatePayout = async (req: Request, res: Response) => {
  const { amount } = req.body;
  const { dueId } = req.params;

  try {
    const due = await Due.findById(dueId);
    if (!due) return res.status(404).json({ message: "Due not found" });

    const payout = await Payout.findOne({ dueId });
    if (!payout || payout.pendingAmount < amount) {
      return res.status(400).json({ message: "Amount exceeds pending or no payout record" });
    }

    // Flutterwave Transfer
    const transferRes = await axios.post(
      "https://api.flutterwave.com/v3/transfers",
      {
        account_bank: "044", // Example - replace with real bank code if you add it later
        account_number: due.accountNumber,
        amount,
        narration: `Payout for ${due.name}`,
        reference: `PAYOUT_${Date.now()}`,
        currency: "NGN",
        beneficiary_name: due.accountName
      },
      { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
    );

    // Update payout
    payout.totalPaidOut += amount;
    payout.pendingAmount -= amount;
    payout.lastPayoutDate = new Date();
    payout.payouts.push({
      amount,
      reference: transferRes.data.data.reference,
      paidAt: new Date(),
      status: "success"
    });
    await payout.save();

    res.json({ message: "Payout initiated successfully", reference: transferRes.data.data.reference });
  } catch (err: any) {
    console.error("Payout error:", err);
    res.status(500).json({ message: "Transfer failed", error: err.message });
  }
};

