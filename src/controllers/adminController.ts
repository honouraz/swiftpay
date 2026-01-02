import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import SubAdmin from "../models/SubAdmin";

export const createSubAdmin = async (req: Request, res: Response) => {
  try {
    // THIS NA THE CORRECT PLACE FOR THIS CODE
    const ADMIN_EMAILS = [
      "olugbengaolajide069@gmail.com",
      "oluwahonouraz@gmail.com"
    ];

    const isSuperAdmin = 
      (req.user?.role === "superadmin") || 
      ADMIN_EMAILS.includes(req.user?.email?.toLowerCase() || "");

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
      association: association || "GENERAL",
      createdBy: req.user?.id,
    });

    res.status(201).json({
      message: "Subadmin created successfully",
      subAdmin: {
        _id: subAdmin._id,
        name: subAdmin.name,
        email: subAdmin.email,
        association: subAdmin.association,
      }
    });
  } catch (err: any) {
    console.error("Create subadmin error:", err);
    res.status(500).json({ message: "Failed to create subadmin" });
  }
};