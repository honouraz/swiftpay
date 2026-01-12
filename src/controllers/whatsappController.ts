import { Request, Response } from "express";
import twilio from "twilio";
import Conversation from "../models/conversation"; // Your model
import Due from "../models/Due"; // Assuming you have Due model
import { paystack } from "../services/paystack";
import { generateReceipt } from "../controllers/receiptController";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const DEPARTMENTS = [
  "Computer Science",
  "Microbiology",
  "Physics And Electronics",
  "Industrial Chemistry",
  "Mathematics",
  "Statistics",
  "Plant Science and Biotechnology",
  "Biochemistry",
  "SLT",
  "Public Health",
  "Health Information Management"
];

export const handleWhatsAppMessage = async (req: Request, res: Response) => {
  try {
    console.log("FULL INCOMING WEBHOOK BODY:", JSON.stringify(req.body, null, 2));

    const from = req.body.From; // whatsapp:+234...
    const waId = from.replace("whatsapp:+", ""); // 234...
    const bodyText = (req.body.Body || "").trim();
    const lowerText = bodyText.toLowerCase();

    if (!from || !bodyText) {
      console.log("No From or Body → status update");
      return res.sendStatus(200);
    }

    console.log(`Incoming from ${from}: "${bodyText}"`);

    // Handle exit/cancel anytime
    if (["exit", "cancel", "stop", "0"].includes(lowerText)) {
      await Conversation.findOneAndUpdate(
        { waId },
        { currentStep: "idle", data: {} },
        { upsert: true, new: true }
      );
      await sendMessage(from, "Session cancelled! Back to main menu 👇\n\n1️⃣ Pay Dues\n2️⃣ Generate Receipt");
      return res.sendStatus(200);
    }

    // Get or create conversation
    let conv = await Conversation.findOne({ waId });
    if (!conv) {
      conv = await Conversation.create({ waId, currentStep: "idle", data: {} });
    }

    let reply = "";

    if (conv.currentStep === "idle") {
      if (lowerText === "1") {
        conv.currentStep = "collect_name";
        conv.data = {};
        reply = "Great! Let's start payment.\n\nPlease send your **Full Name**";
      } else if (lowerText === "2") {
        reply = "Send your payment reference to generate receipt";
      } else {
        reply = "Welcome to SwiftPay 👋\n\nReply with:\n1️⃣ Pay Dues\n2️⃣ Generate Receipt\n\n(Type 'exit' anytime to cancel)";
      }
    } else if (conv.currentStep === "collect_name") {
      conv.data.name = bodyText;
      conv.currentStep = "collect_matric";
      reply = "Got it! Now send your **Matric Number** (e.g. FMC/2020/6969)";
    } else if (conv.currentStep === "collect_matric") {
      conv.data.matricNumber = bodyText;
      conv.currentStep = "collect_phone";
      reply = "Thanks! Now send your **Phone Number** (e.g. 08123456789)";
    } else if (conv.currentStep === "collect_phone") {
      conv.data.phone = bodyText;
      conv.currentStep = "collect_email";
      reply = "Almost there! Send your **Email** (optional, but recommended)";
    } else if (conv.currentStep === "collect_email") {
      conv.data.email = bodyText || "noemail@swiftpay.com";
      conv.currentStep = "choose_dept";
      const deptList = DEPARTMENTS.map((d, i) => `${i + 1}. ${d}`).join("\n");
      reply = `Select your **Department** by replying with the number:\n\n${deptList}`;
    } else if (conv.currentStep === "choose_dept") {
      const deptIndex = parseInt(bodyText) - 1;
      if (isNaN(deptIndex) || deptIndex < 0 || deptIndex >= DEPARTMENTS.length) {
        reply = "Invalid number. Try again.";
      } else {
        conv.data.department = DEPARTMENTS[deptIndex];
        conv.currentStep = "choose_due";

        // Fetch dues from DB
        const dues = await Due.find().select("name _id");
        if (dues.length === 0) {
          reply = "No dues available right now. Try later!";
          conv.currentStep = "idle";
        } else {
          const dueList = dues.map((d, i) => `${i + 1}. ${d.name}`).join("\n");
          reply = `Select the **Due** you want to pay:\n\n${dueList}`;
        }
      }
    } else if (conv.currentStep === "choose_due") {
      const dues = await Due.find().select("name _id");
      const dueIndex = parseInt(bodyText) - 1;
      if (isNaN(dueIndex) || dueIndex < 0 || dueIndex >= dues.length) {
        reply = "Invalid choice. Try again.";
      } else {
        const selectedDue = dues[dueIndex];
        conv.data.dueId = selectedDue._id.toString();
        conv.data.dueName = selectedDue.name;

        conv.currentStep = "choose_level";
        reply = "Select your **Level**:\n\n1. 100 Level\n2. 200 Level\n3. 300 Level\n4. 400 Level\n5. 500 Level";
      }
    } else if (conv.currentStep === "choose_level") {
      const levelMap: Record<string, string> = { "1": "100", "2": "200", "3": "300", "4": "400", "5": "500" };
      const level = levelMap[bodyText];
      if (!level) {
        reply = "Invalid level. Reply 1-5.";
      } else {
        conv.data.level = level;

        const selectedDue = await Due.findById(conv.data.dueId);
        if (!selectedDue) {
          reply = "Due not found. Starting over...";
          conv.currentStep = "idle";
          conv.data = {};
          await conv.save();
          await sendMessage(from, reply);
          return res.sendStatus(200);
        }

        const priceKey = level;
        const baseAmount = selectedDue.prices?.[priceKey] || 0;

        if (baseAmount <= 0) {
          reply = "No price set for this level. Contact support.";
        } else {
          const platformFeePercent = selectedDue.platformFeePercent ?? 7;
          const extraCharge = selectedDue.extraCharge ?? 0;
          const platformCommission = selectedDue.extraCharge === 0 
            ? Math.round((baseAmount * platformFeePercent) / 100)
            : 0;
          const totalKobo = Math.round((baseAmount + platformCommission + extraCharge) * 100);

          let customerCode: string;
          try {
            const customerRes = await paystack.post("/customer", {
              email: conv.data.email,
              first_name: conv.data.name.split(" ")[0] || "User",
              last_name: conv.data.name.split(" ").slice(1).join(" ") || "",
              phone: conv.data.phone,
              metadata: {
                matricNumber: conv.data.matricNumber,
                department: conv.data.department,
                waId: waId,
                source: "whatsapp"
              }
            });
            customerCode = customerRes.data.data.customer_code;
          } catch (err: any) {
            console.error("Customer creation error:", err.response?.data || err);
            reply = "Couldn't prepare payment. Try again later or type 'exit'.";
            await conv.save();
            await sendMessage(from, reply);
            return res.sendStatus(200);
          }

          let accountInfo;
          try {
            const dvaRes = await paystack.post("/dedicated_account", {
              customer: customerCode,
              preferred_bank: "wema-bank",
            });
            accountInfo = dvaRes.data.data;
          } catch (err: any) {
            console.error("DVA creation error:", err.response?.data || err);
            reply = "Payment setup failed. Try again later.";
            await conv.save();
            await sendMessage(from, reply);
            return res.sendStatus(200);
          }

          conv.data.reference = "WA_" + Date.now() + "_" + waId.slice(-6);
          conv.data.totalAmount = totalKobo / 100;
          conv.data.baseAmount = baseAmount;
          conv.data.platformCommission = platformCommission;
          conv.data.extraCharge = extraCharge;
          conv.data.customerCode = customerCode;
          conv.data.dvaAccountNumber = accountInfo.account_number;
          conv.data.dvaBankName = accountInfo.bank.name || "Wema Bank";
          conv.currentStep = "payment_pending";

          reply = `Payment ready!\n\n` +
            `Amount: ₦${(totalKobo / 100).toLocaleString()}\n` +
            `Bank: ${accountInfo.bank.name || "Wema Bank"}\n` +
            `Account Number: ${accountInfo.account_number}\n` +
            `Account Name: ${accountInfo.assignee.account_name || conv.data.name}\n\n` +
            `Transfer exactly ₦${(totalKobo / 100).toLocaleString()} to this account now.\n` +
            `We'll confirm automatically within minutes and send your receipt!\n\n` +
            `(Type 'exit' to cancel)`;
        }
      }

      await conv.save();

      if (reply) {
        await sendMessage(from, reply);
      }
    }

    res.sendStatus(200);
  } catch (err: any) {
    console.error("WA Error:", err.message);
    res.sendStatus(200);
  }
};

async function sendMessage(to: string, body: string, mediaUrl?: string[]) {
  const params: any = {
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to,
    body
  };
  if (mediaUrl && mediaUrl.length > 0) {
    params.mediaUrl = mediaUrl;
  }
  await client.messages.create(params);
}