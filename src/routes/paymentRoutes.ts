import express from "express";
import {
  initializePayment,
  verifyPayment,
  getMyPayments,
  getAllPayments,
  searchPayments,
  getBanks,
  verifyAccountName
} from "../controllers/paymentController";
import { generateReceipt } from "../controllers/receiptController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";
import { Router, Request, Response } from "express";
import Payment from "../models/Payment";
import { initiatePayout, getAllPayouts } from "../controllers/payoutController";

const router = express.Router();

// ----- PAYSTACK -----
router.post("/paystack/initialize", initializePayment);
router.get("/paystack/verify/:reference", verifyPayment);

router.post("/flutterwave/initialize", initializePayment);
router.get("/flutterwave/verify/:reference", verifyPayment);

// ----- RECEIPT -----
router.get("/receipt/:reference", generateReceipt);

// ----- USER PAYMENTS -----
router.get("/my", authMiddleware, getMyPayments);

// ----- SUPERADMIN / ALL PAYMENTS -----
router.get("/all", authMiddleware, isSuperAdmin, getAllPayments);
// ----- SEARCH RECEIPTS (ADMIN) -----
router.get("/search", authMiddleware, searchPayments);

router.get("/flutterwave/banks", getBanks);
router.post("/flutterwave/verify-account", verifyAccountName);

// Add these two for payouts (admin only)
router.get("/payouts/all", getAllPayouts);
router.post("/payouts/initiate/:dueId", initiatePayout);

// In src/routes/paymentRoutes.ts
router.get("/verify/:reference", async (req, res) => {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
export default router;
// Remove all Monnify/Flutterwave comments