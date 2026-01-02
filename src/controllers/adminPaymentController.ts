// src/controllers/adminPaymentController.ts
import { Request, Response } from "express";
import Payment from "../models/Payment";

export const getAllPayments = async (_req: Request, res: Response) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });

    res.json(
      payments.map(p => ({
        _id: p._id,
        payerName: p.metadata?.payerName || p.payerName || "Anonymous",
        dueName: (p as any).dueName || p.metadata?.dueName || "SwiftPay Payment", // (p as any) kill the redline
        baseAmount: p.baseAmount || 0,
        paidAt: p.paidAt || new Date(),
        email: p.email,
        status: p.status || "pending",
        level: p.level || p.metadata?.level || "-",
        platformCommission: p.platformCommission || 0,
        extraCharge: p.extraCharge || 0,
        amount: p.amount || 0,
      }))
    );
  } catch (err) {
    console.error("getAllPayments error:", err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};

export const searchPayments = async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    const payments = await Payment.find({
      $or: [
        { "metadata.dueName": { $regex: q, $options: "i" } },
        { "metadata.payerName": { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { "metadata.matricNumber": { $regex: q, $options: "i" } },
        { "metadata.phone": { $regex: q, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    // Return same shape as getAllPayments so frontend no crash
    const formatted = payments.map(p => ({
      _id: p._id,
      payerName: p.metadata?.payerName || p.payerName || "Anonymous",
      dueName: (p as any).dueName || p.metadata?.dueName || "SwiftPay Payment",
      baseAmount: p.baseAmount || 0,
      paidAt: p.paidAt || new Date(),
      email: p.email,
      status: p.status || "pending",
      level: p.level || p.metadata?.level || "-",
      platformCommission: p.platformCommission || 0,
      extraCharge: p.extraCharge || 0,
      amount: p.amount || 0,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("searchPayments error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};