// src/webhook/monnifyWebhook.ts
import { Request, Response } from "express";
import Payment from "../models/Payment";
import crypto from "crypto";

export const monnifyWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["monnify-signature"] as string;
  const raw = (req as any).rawBody;

  // validate signature
  const hash = crypto.createHmac("sha512", process.env.MONNIFY_SECRET_KEY!)
                     .update(raw)
                     .digest("hex");
  if (hash !== sig) {
    console.log("❌ Invalid Monnify signature");
    return res.sendStatus(401);
  }

  const body = JSON.parse(raw.toString());
  const { eventType, eventData } = body;

  if (eventType === "SUCCESSFUL_TRANSACTION") {
    const d = eventData;
    try {
      await Payment.create({
        reference: d.paymentReference,
        amount: Number(d.amountPaid),  // assuming NGN
        email: d.customer?.email || "",
        payerName: d.metaData?.payerName || "Anonymous",
        matricNumber: d.metaData?.matricNumber || "",
        department: d.metaData?.department || "",
        phone: d.metaData?.phone || "",
        dueName: d.paymentDescription,
        paidAt: new Date(d.paidOn),
        metadata: d.metaData,
      });
      console.log("✅ Monnify payment saved:", d.paymentReference);
    } catch (err: any) {
      console.error("❌ Monnify webhook save error:", err.message);
    }
  }

  res.sendStatus(200);
};
