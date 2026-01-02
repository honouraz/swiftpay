import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import { connectDB } from "./src/config/db";
import userRoutes from "./src/routes/userRoutes";
import paymentRoutes from "./src/routes/paymentRoutes";
import dueRoutes from "./src/routes/dueRoutes";
import { paystackWebhook } from "./src/webhook/paystackWebhook";
import Payment from "./src/models/Payment";
import { generateReceipt } from "./src/controllers/receiptController";
import adminRoutes from "./src/routes/adminRoutes";
import subAdminRoutes from "./src/routes/subAdminRoutes";

dotenv.config(); // Must be first

const app = express();

/* ---------------------------------------------
   RAW HANDLER FOR PAYSTACK SIGNATURE
---------------------------------------------- */
app.use(
  bodyParser.json({
    limit: "5mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf; // store raw body for webhook signing
    },
  })
);

/* ---------------------------------------------
   CORS & JSON PARSER
---------------------------------------------- */
app.use(cors());
app.use(express.json());

/* ---------------------------------------------
   PAYSTACK 
---------------------------------------------- */
app.post(
  "/api/webhook/paystack",
  express.raw({ type: "application/json" }),
  (req: any, res: any) => paystackWebhook(req, res)
);



/* ---------------------------------------------
   WEBHOOK TEST ROUTE
---------------------------------------------- */
app.post(
  "/api/webhook/test",
  express.raw({ type: "application/json" }),
  async (req: any, res) => {
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
app.post("/api/test-save-receipt", async (req, res) => {
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
app.post("/api/receipt/:id", (req, res) => {
  console.log("RECEIPT REQUESTED → ID:", req.params.id);
  generateReceipt(req, res);
});

app.all("/api/receipt-by-ref/:reference", async (req: any, res) => {
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
  console.log(`[${req.method}] ${req.url} - Body:`, req.body);
  next();
});

/* ---------------------------------------------
   MOUNT ROUTES
---------------------------------------------- */
app.use("/api/users", userRoutes);
app.use("/api/dues", dueRoutes);
app.use("/api/payments", paymentRoutes);


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
