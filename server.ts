import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import crypto from "crypto";
import { connectDB } from "./src/config/db";
import userRoutes from "./src/routes/userRoutes";
import paymentRoutes from "./src/routes/paymentRoutes";
import dueRoutes from "./src/routes/dueRoutes";
import { paystackWebhook } from "./src/webhook/paystackWebhook";
import Payment from "./src/models/Payment";
import { generateReceipt } from "./src/controllers/receiptController";
import adminRoutes from "./src/routes/adminRoutes";
import subAdminRoutes from "./src/routes/subAdminRoutes";
import whatsappRoutes from "./src/routes/whatsappRoutes";


dotenv.config(); // Must be first

const app = express();

/* ---------------------------------------------
   PAYSTACK 
---------------------------------------------- */
app.post(
  "/api/webhook/paystack",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response) => paystackWebhook(req, res)
);

// Flutterwave Webhook
// Flutterwave Webhook
app.post(
  "/api/webhook/flutterwave",
  express.raw({ type: "*/*" }),
  async (req: Request, res: Response) => {
    try {
      const rawBody = req.body.toString();

      // TEMP DEBUG LOGS (remove later if you want)
      console.log("FLUTTERWAVE RAW BODY:", rawBody);

      let decryptedBody = rawBody;

      // Decrypt if encrypted (new accounts send base64 encrypted)
      if (rawBody && rawBody.length > 0 && rawBody[0] !== "{" && rawBody[0] !== "[") {
        const secret = process.env.FLUTTERWAVE_SECRET_KEY!;

        const md5Key = crypto.createHash("md5").update(secret).digest();
        const tripleDesKey = Buffer.concat([md5Key, md5Key.slice(0, 8)]);

        const decipher = crypto.createDecipheriv("des-ede3", tripleDesKey, "");
        decryptedBody = decipher.update(rawBody, "base64", "utf8");
        decryptedBody += decipher.final("utf8");

        console.log("DECRYPTED BODY:", decryptedBody);
      }

      const event = JSON.parse(decryptedBody);

      console.log("FLUTTERWAVE EVENT RECEIVED:", event.event, event.data?.status);

      if (event.event === "charge.completed" && event.data?.status === "successful") {
        const tx = event.data;
        const ref = tx.tx_ref;

        const payment = await Payment.findOne({ reference: ref });

        if (payment) {
          payment.status = "success";
          payment.paidAt = new Date(tx.created_at || Date.now());
          payment.amount = tx.amount;

          // Restore breakdown from metadata if overwritten/missing
          if (!payment.baseAmount && payment.metadata?.baseAmount) {
            payment.baseAmount = Number(payment.metadata.baseAmount);
          }
          if (!payment.platformCommission && payment.metadata?.platformCommission) {
            payment.platformCommission = Number(payment.metadata.platformCommission);
          }
          if (!payment.extraCharge && payment.metadata?.extraCharge) {
            payment.extraCharge = Number(payment.metadata.extraCharge);
          }

          payment.metadata = {
            ...payment.metadata,
            flutterwave: {
              id: tx.id,
              flw_ref: tx.flw_ref,
              payment_type: tx.payment_type,
            }
          };

          await payment.save();

          console.log("✅ FLUTTERWAVE PAYMENT UPDATED:", ref, "Base restored:", payment.baseAmount);
        } else {
          console.log("Payment not found for ref:", ref);
        }
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("Flutterwave webhook error:", err.message);
      res.sendStatus(200);
    }
  }
);

app.use(cors({
  origin: "*", // Allow all for now — change to your frontend URL later
  credentials: true
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

/* ---------------------------------------------
   WEBHOOK TEST ROUTEs
---------------------------------------------- */
app.post(
  "/api/webhook/test",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    console.log("WEBHOOK TEST HIT");

    try {
      const body = JSON.parse(req.body.toString());
      console.log("FULL PAYSTACK BODY →", body);

      if (body.event === "charge.success") {
        const d = body.data;

        await Payment.create({
          reference: d.reference,
          amount: d.amount / 100,
          email: d.customer.email,
          payerName: d.metadata?.payerName || "Test User",
          matricNumber: d.metadata?.matricNumber || "",
          department: d.metadata?.department || "",
          phone: d.metadata?.phone || "",
          dueName: d.metadata?.dueName || "Test Payment",
          paidAt: new Date(),
        });

        console.log("FORCED SAVE SUCCESS →", d.reference);
      }
    } catch (e: any) {
      console.log("FORCE SAVE FAILED →", e.message);
    }

    res.sendStatus(200);
  }
);

/* ---------------------------------------------
   MANUAL TEST RECEIPT SAVE
---------------------------------------------- */
app.post("/api/test-save-receipt", async (req: Request, res: Response) => {
  try {
    const testPayment = await Payment.create({
      reference: "TEST_" + Date.now(),
      amount: 5000,
      email: "test@swiftpay.com",
      payerName: "Olugbenga Olajide",
      matricNumber: "FMC/2020/6969",
      department: "Computer Science",
      phone: "09012345678",
      dueName: "SUG Dues",
      paidAt: new Date(),
    });

    console.log("TEST RECEIPT SAVED →", testPayment.reference);
    res.json({ success: true, payment: testPayment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------
   TEST SERVER ROUTE
---------------------------------------------- */
app.get("/test", (req: Request, res: Response) => {
  res.json({ message: "SERVER IS ALIVE ✅" });
});

/* ---------------------------------------------
   PDF RECEIPT GENERATOR
---------------------------------------------- */
app.post("/api/receipt/:id", (req: Request, res: Response) => {
  console.log("RECEIPT REQUESTED → ID:", req.params.id);
  generateReceipt(req, res);
});

app.all(
  "/api/receipt-by-ref/:reference",
  async (req: Request & { params: any }, res: Response) => {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference });
    if (!payment) return res.status(404).send("Payment not found");

    req.params.id = payment._id.toString();
    generateReceipt(req, res);
  } catch (err: any) {
    console.error("Receipt by ref error:", err);
    if (!res.headersSent) res.status(500).send("Error");
  }
}); 

/* ---------------------------------------------
   REQUEST LOGGER (keep this last)
---------------------------------------------- */
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl.includes("/webhook")) {
    console.log(`[${req.method}] ${req.url} - RAW BODY RECEIVED`);
  } else {
    console.log(`[${req.method}] ${req.url} - Body:`, req.body);
  }
  next();
});

/* ---------------------------------------------
   MOUNT ROUTES
---------------------------------------------- */
app.use("/api/users", userRoutes);
app.use("/api/dues", dueRoutes);
app.use("/api/payments", paymentRoutes);

app.use("/api/whatsapp", whatsappRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/subadmin", subAdminRoutes);
app.use("/api", paymentRoutes);
/* ---------------------------------------------
   INITIALIZE PAYMENT
---------------------------------------------- */

/* ---------------------------------------------
   CONNECT DB
---------------------------------------------- */
connectDB();

/* ---------------------------------------------
   GLOBAL ERROR HANDLER
---------------------------------------------- */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🚨 GLOBAL ERROR:", err);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
    stack: err.stack,
  });
});

/* ---------------------------------------------
   SERVER START
---------------------------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on http://localhost:${PORT}`);
  console.log("💸 Payment endpoint → POST /api/payments/initialize");
});
