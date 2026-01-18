import { Response, Request } from "express";
import { AuthRequest } from "../types/AuthRequest";
import SubAdmin from "../models/SubAdmin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Payment from "../models/Payment";

export const createSubAdmin = async (req: AuthRequest, res: Response) => {
  try {
    // FIX: Check both role from token and email fallback
    const isSuperAdmin = req.user?.role === "superadmin" || 
      ["olugbengaolajide069@gmail.com", "oluwahonouraz@gmail.com"].includes(req.user?.email?.toLowerCase() || "");

    if (!isSuperAdmin) {
      return res.status(403).json({ message: "Access denied - Superadmin only" });
    }

    const { name, email, password, association } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const subAdmin = await SubAdmin.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      association: association || "GENERAL", // optional
      createdBy: req.user?.id,
    });

    res.status(201).json({
      message: "Subadmin created successfully",
      subAdmin: {
        _id: subAdmin._id,
        name: subAdmin.name,
        email: subAdmin.email,
        association: subAdmin.association,
        createdAt: subAdmin.createdAt,
      }
    });
  } catch (err: any) {
    console.error("Create subadmin error:", err);
    res.status(500).json({ message: "Failed to create subadmin", error: err.message });
  }
};

export const getAllSubAdmins = async (req: Request, res: Response) => {
  try {
    const subs = await SubAdmin.find().sort({ createdAt: -1 });
    res.status(200).json(subs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
export const getByAssociation = async (req: any, res: Response) => {
  try {
    const { associationName } = req.params;
    const subs = await SubAdmin.find({ association: associationName });
    res.status(200).json(subs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
export const getSubAdmins = async (req: Request, res: Response) => {
  try {
    const subAdmins = await SubAdmin.find().select("-password");
    res.json(subAdmins);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch subadmins" });
  }
};
export const getSubAdminPayments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const subadminId = req.user.id;
    const subadmin = await SubAdmin.findById(subadminId);
    if (!subadmin) return res.status(404).json({ message: "Subadmin not found" });

    // Match payments by dueName or metadata.dueName (case-insensitive)
    const payments = await Payment.find({
  status: "success",
  $or: [
    { dueName: { $regex: escapeRegex(subadmin.association), $options: "i" } },
    { "metadata.dueName": { $regex: escapeRegex(subadmin.association), $options: "i" } },
    { "metadata.dueName": subadmin.association }, // exact match fallback
  ]
}).sort({ paidAt: -1 });

// Helper to escape special regex chars
function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

    console.log(`Subadmin ${subadmin.email} fetched ${payments.length} payments for association: ${subadmin.association}`);
console.log("Searching for association:", subadmin.association);
console.log("All payments count:", await Payment.countDocuments({ status: "success" }));
console.log("Matching payments:", payments.length);

    res.json(payments);
  } catch (err: any) {
    console.error("Payments fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const loginSubAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const subAdmin = await SubAdmin.findOne({ email: email.toLowerCase() }).select("+password");
    if (!subAdmin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, subAdmin.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Safe token generation
    const token = jwt.sign(
      { 
        id: subAdmin._id.toString(), 
        role: "subadmin" as const,  // force literal type
        association: subAdmin.association ?? "GENERAL"  // fallback if undefined
      },
      process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );

    res.json({
      message: "Subadmin login successful",
      token,
      user: {
        _id: subAdmin._id,
        name: subAdmin.name,
        email: subAdmin.email,
        role: "subadmin",
        association: subAdmin.association ?? "GENERAL",
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};