import { initiatePayout } from "../controllers/payoutController";
import { getMyPayout } from "../controllers/subAdminController";
import express from "express";
const router = express.Router();
// routes/payout.ts
router.get("/payouts/all", initiatePayout); // admin only
router.get("/payouts/my", getMyPayout); // subadmin
router.post("/payouts/initiate/:dueId", initiatePayout); // admin only