// src/controllers/receiptController.ts
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import { Request, Response } from "express";
import Payment from "../models/Payment";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Generates a beautiful, modern PDF receipt for SwiftPay.
 * Features:
 * - Clean, minimalist aesthetic with professional typography
 * - Dynamic color accents based on payment type
 * - Secure QR code verification
 * - Cryptographic hash for tamper-proofing
 */

export const generateReceiptBuffer = async (paymentId: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const fakeReq = { params: { id: paymentId } } as any;
    const chunks: Buffer[] = [];
    const fakeRes = {
      setHeader: () => {},
      write: (chunk: Buffer) => chunks.push(chunk),
      end: () => resolve(Buffer.concat(chunks)),
      status: () => fakeRes,
    } as any;

    generateReceipt(fakeReq, fakeRes).catch(reject);
  });
};

const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadReceiptToCloudinary = async (pdfBuffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'swiftpay/receipts' },
      (error: any, result: unknown) => error ? reject(error) : resolve(result)
    ).end(pdfBuffer);
  });
};

export const generateReceiptByMatric = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findOne({
      "metadata.matricNumber": req.params.matric,
      status: "success"
    } as any).sort({ createdAt: -1 });

    if (!payment) return res.status(404).send("Payment not found");

    req.params.id = (payment as any)._id.toString();
    return generateReceipt(req, res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

export const generateReceipt = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id).lean() as any;
    if (!payment) return res.status(404).send("Payment not found");

    const meta = (payment.metadata as any) || {};
    const dueName = meta.dueName || "SwiftPay Payment";
    const level = meta.level || "N/A";
    const payerName = meta.payerName || "Student";
    const matric = meta.matricNumber || "Unknown";

    const clean = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Receipt_${clean(dueName)}_${clean(payerName)}.pdf`;

    const receiptSerial = `SP-${payment._id.toString().slice(-6).toUpperCase()}`;

    const hash = crypto
      .createHash("sha256")
      .update(`${payment.reference}${payment.baseAmount}${receiptSerial}`)
      .digest("hex")
      .slice(0, 20);

    // Create document with generous margins
    const doc = new PDFDocument({ 
      size: "A4", 
      margin: 50,
      info: {
        Title: `Receipt - ${dueName}`,
        Author: 'SwiftPay',
      }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const publicPath = path.join(process.cwd(), "public");

    // ===== DYNAMIC BRANDING COLORS =====
    let primaryColor = "#1A1A1A"; // Deep Charcoal
    let accentColor = "#3F51B5";  // Indigo
    
    const lowerDue = dueName.toLowerCase();
    if (lowerDue.includes("nass")) accentColor = "#091583";
    else if (lowerDue.includes("esan")) accentColor = "#FF5722";
    else if (lowerDue.includes("sossa")) accentColor = "#9C27B0";
    else if (lowerDue.includes("idowu")) accentColor = "#2E7D32";

    // ===== BACKGROUND & DECORATION =====
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#F9FAFB");
    doc.rect(0, 0, 8, doc.page.height).fill(accentColor); // Side accent bar

    // ===== HEADER SECTION =====
    doc.rect(0, 0, doc.page.width, 120).fill("#FFFFFF");
    doc.rect(0, 118, doc.page.width, 2).fill(accentColor + "22");

    const swiftLogo = path.join(publicPath, "swiftpay-logo.png");
    if (fs.existsSync(swiftLogo)) {
      doc.image(swiftLogo, 50, 35, { width: 140 });
    } else {
      doc.fillColor(accentColor).fontSize(24).font("Helvetica-Bold").text("SWIFTPAY", 50, 45);
    }

    doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold")
      .text("OFFICIAL PAYMENT RECEIPT", 0, 40, { align: "right", width: doc.page.width - 50 });
    
    doc.fillColor("#6B7280").fontSize(9).font("Helvetica")
      .text(`Serial: ${receiptSerial}`, 0, 55, { align: "right", width: doc.page.width - 50 });
    
    doc.text(`Date: ${new Date(payment.paidAt || Date.now()).toLocaleDateString('en-GB')}`, 0, 68, { align: "right", width: doc.page.width - 50 });

    // ===== CONTENT BODY =====
    let y = 160;

    doc.fillColor(accentColor).fontSize(12).font("Helvetica-Bold").text("BILLING DETAILS", 50, y);
    y += 20;
    doc.rect(50, y, 40, 2).fill(accentColor);
    y += 15;

    const drawField = (label: string, value: string, currentY: number, isRight = false) => {
      const x = isRight ? doc.page.width / 2 + 20 : 50;
      doc.fillColor("#9CA3AF").fontSize(8).font("Helvetica-Bold").text(label.toUpperCase(), x, currentY);
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica").text(value || "N/A", x, currentY + 12);
    };

    drawField("Student Name", payerName, y);
    drawField("Matric Number", matric, y, true);
    y += 45;

    drawField("Department", meta.department || "General", y);
    drawField("Level", level, y, true);
    y += 45;

    drawField("Payment For", dueName, y);
    drawField("Transaction Ref", payment.reference, y, true);
    y += 60;

    // ===== AMOUNT HIGHLIGHT BOX =====
    doc.roundedRect(50, y, doc.page.width - 100, 100, 8).fill("#FFFFFF");
    doc.roundedRect(50, y, doc.page.width - 100, 100, 8).lineWidth(0.5).stroke("#E5E7EB");

    doc.fillColor("#6B7280").fontSize(10).font("Helvetica").text("Total Amount Paid", 75, y + 25);
    doc.fillColor(primaryColor).fontSize(32).font("Helvetica-Bold").text(`₦${payment.baseAmount.toLocaleString()}`, 75, y + 42);

    // Status Badge
    const statusMap: any = {
      success: { label: "SUCCESSFUL", color: "#10B981", bg: "#ECFDF5" },
      pending: { label: "PENDING", color: "#F59E0B", bg: "#FFFBEB" },
      failed: { label: "FAILED", color: "#EF4444", bg: "#FEF2F2" },
    };
    const status = statusMap[payment.status] || statusMap.pending;

    const badgeWidth = 90;
    doc.roundedRect(doc.page.width - 50 - badgeWidth - 25, y + 35, badgeWidth, 30, 15).fill(status.bg);
    doc.fillColor(status.color).fontSize(9).font("Helvetica-Bold")
      .text(status.label, doc.page.width - 50 - badgeWidth - 25, y + 46, { width: badgeWidth, align: "center" });

    y += 130;

    // ===== VERIFICATION & SECURITY =====
    const verifyUrl = `${process.env.FRONTEND_URL || 'https://swiftpay.ng'}/verify/${payment.reference}`;
    const qrData = await QRCode.toDataURL(verifyUrl, { margin: 1, color: { dark: primaryColor, light: "#FFFFFF00" } });
    const qrBuffer = Buffer.from(qrData.split(",")[1], "base64");
    
    doc.image(qrBuffer, doc.page.width - 160, y, { width: 110 });
    doc.fillColor("#9CA3AF").fontSize(7).font("Helvetica")
      .text("SCAN TO VERIFY AUTHENTICITY", doc.page.width - 160, y + 115, { width: 110, align: "center" });

    const signPath = path.join(publicPath, "signature.png");
    if (fs.existsSync(signPath)) {
      doc.image(signPath, 50, y + 20, { width: 100 });
      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text("Authorized Signatory", 50, y + 85);
    }

    // ===== FOOTER =====
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill("#FFFFFF");
    doc.rect(0, footerY, doc.page.width, 1).fill("#E5E7EB");

    doc.fillColor("#9CA3AF").fontSize(7).font("Helvetica").text(`SECURITY HASH: ${hash}`, 50, footerY + 20);
    doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text("Thank you for using SwiftPay", 0, footerY + 40, { align: "center", width: doc.page.width });
    doc.fillColor("#6B7280").fontSize(8).font("Helvetica")
      .text("This is a computer-generated document. No physical signature required.", 0, footerY + 55, { align: "center", width: doc.page.width });

    doc.end();
  } catch (err) {
    console.error("PDF ERROR:", err);
    if (!res.headersSent) res.status(500).send("Failed to generate receipt");
  }
};
