import { Request, Response } from "express";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const handleWhatsAppMessage = async (req: Request, res: Response) => {
  try {
    // For sandbox, only POST comes – no GET verification
    if (req.method !== "POST") return res.sendStatus(405);

    const body = req.body;

    // Check if there's actually a message (ignore delivery statuses)
    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      console.log("Status update or empty webhook – ignoring");
      return res.sendStatus(200);
    }

    const message = body.entry[0].changes[0].value.messages[0];
    const fromWaId = message.from; // e.g. "2348127327090" (without +)
    const text = message.text?.body?.trim().toLowerCase() || "";

    console.log(`Incoming WA from ${fromWaId}: "${text}"`);

    let reply = "Welcome to SwiftPay 👋\n\nReply with:\n1 - Pay Dues\n2 - Generate Receipt";

    if (text === "1") {
      reply = "Send your matric number to start payment";
    } else if (text === "2") {
      reply = "Send your payment reference to get receipt";
    } else if (text.includes("hi") || text === "") {
      // welcome stays
    } else {
      reply = "Invalid. Reply with 1 or 2";
    }

    // Send reply using Twilio
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // e.g. whatsapp:+14155238886
      to: `whatsapp:+${fromWaId}`,
      body: reply
    });

    res.sendStatus(200); // ALWAYS 200 for Twilio/Meta
  } catch (err: any) {
    console.error("WA Error:", err.message);
    res.sendStatus(200); // Never send error to Twilio
  }
};