import express from "express";
import { handleWhatsAppMessage } from "../controllers/whatsappController";

const router = express.Router();

router.post("/webhook", handleWhatsAppMessage);

export default router;
