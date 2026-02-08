// src/controllers/receiptController.ts
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import { Request, Response } from "express";
import Payment from "../models/Payment";
import path from "path";
import fs from "fs";

export const generateReceiptBuffer = async (paymentId: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const fakeReq = { params: { id: paymentId } } as any;
    const chunks: Buffer[] = [];
    const fakeRes = {
      setHeader: () => {},
      write: (chunk: Buffer) => chunks.push(chunk),
      end: () => resolve(Buffer.concat(chunks)),
      status: () => fakeRes,
    };

    generateReceipt(fakeReq, fakeRes as any);
  });
};

export const generateReceipt = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).send("Payment not found");

    const meta = (payment.metadata as any) || {};
    const dueName = typeof meta.dueName === "string" ? meta.dueName : "SwiftPay Payment";

    // Filename: PayerName_Matric.pdf
    const payerName = meta.payerName || "Student";
    const matric = meta.matricNumber || "Unknown";
    const cleanName = payerName.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanMatric = matric.replace(/[^a-zA-Z0-9]/g, "_");
    const cleandueName = dueName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${cleandueName}_${cleanName}_${cleanMatric}.pdf`;

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
   res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Background Image — full opacity 0.15
    const publicPath = path.join(process.cwd(), "public");
const bgPath = path.join(publicPath, "receipt-bg.jpg");
    if (fs.existsSync(bgPath)) {
      // PDFKit does not accept an 'opacity' option on image; use graphics state instead
      doc.save();
doc.opacity(0.08); // subtle watermark
doc.image(bgPath, doc.page.width / 4, doc.page.height / 3, {
  width: 300,
});
doc.restore();

    }

    // Color Map
    let headerColor = "#3F51B5";
    const lowerDue = dueName.toLowerCase();
    if (lowerDue.includes("nass")) headerColor = "#ace9b0ff";
    else if (lowerDue.includes("sug")) headerColor = "#4CAF50";
    else if (lowerDue.includes("esan")) headerColor = "#FF5722";
    else if (lowerDue.includes("sossa")) headerColor = "#9C27B0";
    else if (lowerDue.includes("idowu")) headerColor = "#20ef12ff";

    // Header Bar — full width
    doc.rect(0, 0, doc.page.width, 140).fill(headerColor);

    // ← Swiftpay top left small

    doc.fillColor("white").fontSize(14).font("Helvetica-Bold")
       .text("Swiftpayby HON. TECH", 50, 20);

    // BIG SwiftPay Logo top left
const swiftLogoPath = path.join(publicPath, "swiftpay-logo.png");
    if (fs.existsSync(swiftLogoPath)) {
      doc.image(swiftLogoPath, 50, 50, { width: 220 }); // BIG like old
    }

    // Title center under logo
    doc.fillColor("white").fontSize(32).font("Helvetica-Bold")
       .text("SWIFTPAY", doc.page.width / 10, 60, { align: "center" });

    doc.fontSize(18).text("Payment Receipt", doc.page.width / 10, 100, { align: "center" });

    // Association Logo top right — far end, no overlap
let assocLogoPath = path.join(publicPath, "nas");    
if (lowerDue.includes("nass")) 
  assocLogoPath = path.join(publicPath, "nass.png");
    else if (lowerDue.includes("sug")) 
      assocLogoPath = path.join(publicPath, "sug.png");
    else if (lowerDue.includes("idowu"))
       assocLogoPath = path.join(publicPath, "idowu.png");

    console.log("BG PATH:", bgPath);
console.log("EXISTS:", fs.existsSync(bgPath));


    if (fs.existsSync(assocLogoPath)) {
      doc.image(assocLogoPath, doc.page.width - 180, 20, { width: 140 }); // Far right, safe
    }

    // Fields — start lower, spread to fill page
    let y = 200;
    const field = (label: string, value: string, p0?: string) => {
      doc.fillColor("black").fontSize(16).font("Helvetica-Bold")
         .text(label + ":", 70, y);
      doc.fontSize(16).font("Helvetica")
         .text(value, 240, y);
      y += 40; // Space to fill page
    };

    field("Student Name", payerName);
    field("Matric Number", matric);
    field("Department", meta.department || "N/A");
    field("Level", meta.Level || "N/A");
    field("Phone", meta.phone || "N/A");
    field("Payment For", dueName);
    field("Reference", payment.reference);
field("Amount", `₦${payment.baseAmount.toLocaleString()}`);    field("Status", payment.status === "success" ? "Successful" : "Pending");
    field("Date", new Date(payment.paidAt || Date.now())
                    .toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    .replace(",", ""));

    // Amount Box — big blue rounded, with ₦ sign
    y += 30;
    const boxY = y;
    doc.roundedRect(70, boxY, doc.page.width - 140, 80, 25).fill(headerColor);

    doc.fillColor("white").fontSize(18).font("Helvetica-Bold")
       .text("Amount Paid", 90, boxY + 20);

    doc.fontSize(40).text(`₦${(payment.baseAmount || 0).toLocaleString()}`, 90, boxY + 50); // ₦ big & correct

    // QR Code bottom right
const verifyUrl = `https://www.swiftpayp.pro/verify/${payment.reference}`;
    const qrData = await QRCode.toDataURL(verifyUrl);
    const qrBuffer = Buffer.from(qrData.split(",")[1], "base64");
    doc.image(qrBuffer, doc.page.width - 150, doc.page.height - 180, { width: 110 });
doc.fontSize(9).fillColor("black")
  .text("Scan to verify authenticity", doc.page.width - 170, doc.page.height - 60);


    doc.fontSize(10).fillColor("gray")
  .text(
    "This receipt is system-generated and verifiable only via SwiftPay QR code. Any alteration invalidates it.",
    70,
    doc.page.height - 90
  );

    // Footer
    doc.fillColor("black").fontSize(14).font("Helvetica-Bold")
       .text("Powered by SwiftPay", 0, doc.page.height - 60, { align: "center", width: doc.page.width });

    doc.end();
  } catch (err: any) {
    console.error("PDF ERROR:", err);
    if (!res.headersSent) res.status(500).send("Failed to generate receipt");
  }
};
