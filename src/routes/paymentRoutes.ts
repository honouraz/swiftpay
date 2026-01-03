import express from "express";
import {
  initializePayment,
  verifyPayment,
  getMyPayments,
  getAllPayments,
  searchPayments
} from "../controllers/paymentController";
import { generateReceipt } from "../controllers/receiptController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";
import { Router, Request, Response } from "express";

const router = express.Router();

// ----- PAYSTACK -----
router.post("/paystack/initialize", initializePayment);
router.get("/paystack/verify/:reference", verifyPayment);


// ----- RECEIPT -----
router.get("/receipt/:reference", generateReceipt);

// ----- USER PAYMENTS -----
router.get("/my", authMiddleware, getMyPayments);

// ----- SUPERADMIN / ALL PAYMENTS -----
router.get("/all", authMiddleware, isSuperAdmin, getAllPayments);
// ----- SEARCH RECEIPTS (ADMIN) -----
router.get("/search", authMiddleware, searchPayments);

export default router;
// Remove all Monnify/Flutterwave comments