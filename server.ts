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
// Flutterwave Webhook with decryption for new accounts
app.post(
  "/api/webhook/flutterwave",
  express.raw({ type: "*/*" }),
  async (req: Request, res: Response) => {
    try {
      const rawBody = req.body.toString();
      console.log("RAW ENCRYPTED BODY:", rawBody); // Go show gibberish if encrypted

      let event;

      // If body looks encrypted (not valid JSON with {), decrypt it
      if (rawBody && rawBody.length > 0 && rawBody[0] !== "{") {
        const secret = process.env.FLUTTERWAVE_SECRET_KEY!; // Your main secret key

        // Decrypt (Flutterwave uses Triple DES)
        const md5Key = crypto.createHash("md5").update(secret).digest();
        const tripleDesKey = Buffer.concat([md5Key, md5Key.slice(0, 8)]);

        const decipher = crypto.createDecipheriv("des-ede3", tripleDesKey, "");
        let decrypted = decipher.update(rawBody, "base64", "utf8");
        decrypted += decipher.final("utf8");

        console.log("DECRYPTED BODY:", decrypted);

        event = JSON.parse(decrypted);
      } else {
        // Old plain JSON
        event = JSON.parse(rawBody);
      }

      console.log("FINAL EVENT:", event.event || event.type, event.data?.status || event.status);

      const isSuccess = 
        (event.event === "charge.completed" && event.data?.status === "successful") ||
        (event.type === "CHARGE.COMPLETED" && event.data?.status === "successful");

      if (isSuccess) {
        const tx = event.data || event;
        const ref = tx.tx_ref || tx.reference;

        const payment = await Payment.findOne({ reference: ref });

        if (payment) {
          payment.status = "success";
          payment.paidAt = new Date(tx.created_at || Date.now());
          payment.amount = tx.amount;

          // Restore baseAmount etc.
          payment.baseAmount = payment.baseAmount || Number(payment.metadata?.baseAmount || 0);
          payment.platformCommission = payment.platformCommission || Number(payment.metadata?.platformCommission || 0);
          payment.extraCharge = payment.extraCharge || Number(payment.metadata?.extraCharge || 0);

          payment.metadata = { ...payment.metadata, flutterwave: tx };

          await payment.save();

          console.log("✅ SUCCESS (NEW ACCOUNT DECRYPTED):", ref);
        }
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("Webhook error:", err.message);
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
