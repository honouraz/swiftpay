import { getAllPayouts, initiatePayout } from "../controllers/payoutController";
import { getMyPayout } from "../controllers/subAdminController";
import express from "express";
const router = express.Router();
// routes/payout.ts
router.get("/payouts/all", getAllPayouts); // admin only
router.post("/payouts/initiate/:dueId", initiatePayout);
router.get("/payouts/my", getMyPayout);
