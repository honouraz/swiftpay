// src/routes/paystackWebhook.ts
import express from "express";
import { paystackWebhook } from "../webhook/paystackWebhook";

const router = express.Router();

router.post("/", paystackWebhook);

export default router;
