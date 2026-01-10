import { Request, Response } from "express";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const handleWhatsAppMessage = async (req: Request, res: Response) => {
  try {
    // Twilio Sandbox uses form-urlencoded POST (not JSON), so use req.body directly
    // For safety, log the full incoming body once to debug
    console.log("FULL INCOMING WEBHOOK BODY:", JSON.stringify(req.body, null, 2));

    const from = req.body.From;          // whatsapp:+234...
    const to = req.body.To;              // whatsapp:+1415...
    const bodyText = (req.body.Body || "").trim();  // the message text

    if (!from || !bodyText) {
      console.log("No From or Body → likely status update");
      return res.sendStatus(200);
    }

    console.log(`Incoming WhatsApp from ${from}: "${bodyText}"`);

    let replyText = "Welcome to SwiftPay 👋\n\nReply with:\n1️⃣ Pay Dues\n2️⃣ Generate Receipt";

    const lowerText = bodyText.toLowerCase();

    if (lowerText === "1") {
      replyText = "Please send your matric number to proceed with payment";
    } else if (lowerText === "2") {
      replyText = "Send your payment reference to generate receipt";
    } else if (lowerText.includes("hi") || lowerText === "") {
      // welcome message
    } else {
      replyText = "Invalid option. Reply with 1 or 2.";
    }

    // Send the reply
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,  // e.g. whatsapp:+14155238886
      to: from,
      body: replyText
    });

    res.sendStatus(200);
  } catch (err: any) {
    console.error("WhatsApp webhook error:", err.message);
    res.sendStatus(200); // MUST return 200 always
  }
};