import express from "express";
import { getAllPayments, searchPayments } from "../controllers/adminPaymentController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";
import { Router, Request, Response } from "express";

const router = express.Router();

router.get("/all", authMiddleware, isSuperAdmin, getAllPayments);
router.get("/search", authMiddleware, isSuperAdmin, searchPayments);

export default router;
