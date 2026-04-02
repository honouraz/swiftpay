import express from "express";
import {
  initializePayment,
  verifyPayment,
  getMyPayments,
  getAllPayments,
  searchPayments,
  getBanks,
  verifyAccountName,
  getPaymentStatus,
  verifyFlutterwavePayment,
  getPublicPaymentStatus,
  searchPublicReceipts,
} from "../controllers/paymentController";
import { generateReceipt, generateReceiptByMatric } from "../controllers/receiptController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";
import { Router, Request, Response } from "express";
import Payment from "../models/Payment";
import { initiatePayout, getAllPayouts } from "../controllers/payoutController";
import { createVirtualAccount } from "../controllers/virtualAccountController";

const router = express.Router();

// ----- PAYSTACK -----
router.post("/paystack/initialize", initializePayment);
router.get("/paystack/verify/:reference", verifyPayment);

router.post("/flutterwave/initialize", initializePayment);
router.get("/flutterwave/verify/:reference", verifyPayment);
// paymentRoutes.ts
router.get("/flutterwave/verify/:reference", verifyFlutterwavePayment);

// ----- VIRTUAL ACCOUNT -----
router.post("/create-va", createVirtualAccount)

// ----- RECEIPT -----
router.get("/receipt/:reference", generateReceipt);
router.get("/payments/receipt/matric/:matric", generateReceiptByMatric);

router.get("/payments/:reference/receipt", authMiddleware, async (req, res) => {
  try {
    // Optional: add role check if needed (e.g. isSuperAdmin or owner)
    const payment = await Payment.findOne({ reference: req.params.reference });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    // Reuse your existing generateReceipt logic
    // If generateReceipt expects req.params.reference, just pass it
    req.params.reference = payment.reference;  // make sure it uses the right param name
    return generateReceipt(req, res);
  } catch (err) {
    console.error("Receipt proxy error:", err);
    res.status(500).json({ message: "Failed to generate receipt" });
  }
});
// ----- USER PAYMENTS -----
router.get("/my", authMiddleware, getMyPayments);

// Add this to your paymentRoutes.ts
router.get('/status/:reference', getPublicPaymentStatus);

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
// QR VERIFY — SUBADMIN ONLY
router.post(
  "/payments/:id/confirm",
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const payment = await Payment.findById(req.params.id);

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Role check
      if (req.user.role !== "subadmin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // 🔐 Association check
      if (payment.association !== req.user.association) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Already confirmed
      if (payment.confirmed) {
        return res.json({
          status: "already_confirmed",
          message: "Payment already confirmed",
        });
      }

      // Confirm payment
      payment.confirmed = true;
      payment.confirmedAt = new Date();
      payment.confirmedBy = req.user._id;
      payment.qrScans += 1;

      await payment.save();

      return res.json({
        status: "confirmed",
        payment,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);


router.post(
  "/payments/verify/:reference",
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const payment = await Payment.findOne({
        reference: req.params.reference,
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (req.user.role !== "subadmin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (payment.association !== req.user.association) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (payment.confirmed) {
        return res.json({
          status: "already_confirmed",
          message: "Payment already confirmed",
        });
      }

      payment.confirmed = true;
      payment.confirmedAt = new Date();
      payment.confirmedBy = req.user._id;
      payment.qrScans += 1;

      await payment.save();

      return res.json({
        status: "confirmed",
        message: "Payment confirmed successfully",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/payments/status/:reference",
  getPaymentStatus
);

// Add this to your paymentRoutes.ts
router.get('/public-search', searchPublicReceipts);
export default router;
// Remove all Monnify/Flutterwave comments