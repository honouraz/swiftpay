import crypto from "crypto";
import Payment from "../models/Payment";
import User from "../models/User";
import { Request, Response } from "express";

export const paystackWebhook = async (req: Request & { body: Buffer }, res: Response) => {
  try {
    const raw = req.body;
    const secret = process.env.PAYSTACK_SECRET_KEY!;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(raw)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.log("❌ Invalid Paystack signature");
      return res.sendStatus(401);
    }

    const event = JSON.parse(raw.toString());

    if (event.event === "charge.success") {
      const d = event.data;
      const meta = d.metadata || {};

      const baseAmount = Number(meta.baseAmount || 0);
const platformCommission = Number(meta.platformCommission || 0);
const extraCharge = Number(meta.extraCharge || 0);

      const totalAmount = d.amount / 100;

      // Find user by email for userId
      let userId = null;
      const user = await User.findOne({ email: d.customer.email });
      if (user) userId = user._id;

      const payment = await Payment.findOneAndUpdate(
        { reference: d.reference },
        {
          status: "success",
          email: d.customer.email,
          payerName: meta.payerName || "",
          matricNumber: meta.matricNumber || "",
          department: meta.department || "",
          phone: meta.phone || "",
          level: meta.level || "",

          dueId: meta.dueId || null,
          dueName: meta.dueName || "SwiftPay Payment",

          baseAmount,
          platformCommission,
          extraCharge,
          amount: totalAmount,

          paidAt: new Date(d.paid_at),
          metadata: meta,
          userId,  // Add here
        },
        { new: true, upsert: true }
      );

      // ... after await Payment.findOneAndUpdate(...)

      console.log("✅ PAYSTACK PAYMENT SAVED:", payment.reference);

      // NEW: Try to find matching WhatsApp conversation & send receipt
      try {
        const waConv = await Conversation.findOne({
          "data.reference": payment.reference,
          currentStep: "payment_pending"
        });

        if (waConv) {
          // Generate receipt PDF (your existing function)
          // IMPORTANT: generateReceipt needs req.params.id = payment._id
          // We fake a req/res just for generation
          const fakeReq = { params: { id: payment._id.toString() } } as any;
          const fakeRes = {
            setHeader: () => {},
            send: (buffer: Buffer) => buffer, // capture PDF buffer
            status: () => fakeRes,
            end: () => {}
          };

          // Call your receipt generator → assume it returns PDF buffer
          const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            fakeRes.send = resolve;
            generateReceipt(fakeReq, fakeRes as any);
          });

          // Option A: Host PDF temporarily (best for production)
          // You need a way to upload → e.g. to Render static folder, AWS S3, tmpfiles.org, etc.
          // For now, placeholder: assume you have a function uploadPdf(buffer) → returns public URL
          // const pdfUrl = await uploadPdfToPublic(pdfBuffer);

          // Option B (sandbox/testing): Send text confirmation + reference
          const receiptMessage = `🎉 Payment confirmed!\n\n` +
            `Receipt for: ${payment.dueName}\n` +
            `Amount: ₦${payment.amount.toLocaleString()}\n` +
            `Payer: ${payment.payerName}\n` +
            `Matric: ${payment.matricNumber}\n` +
            `Reference: ${payment.reference}\n\n` +
            `Full receipt coming soon!`;

          await sendMessage(
            `whatsapp:+${waConv.waId}`,
            receiptMessage
            // mediaUrl: [pdfUrl]  // ← enable when you have public URL
          );

          // Reset conversation
          waConv.currentStep = "idle";
          waConv.data = {};
          await waConv.save();
        }
      } catch (receiptErr: any) {
        console.error("Receipt send error:", receiptErr.message);
        // Don't fail webhook — still 200
      }
        }
  } catch (err: any) {
    console.error("❌ WEBHOOK ERROR:", err.message);
  }

  res.sendStatus(200);
};