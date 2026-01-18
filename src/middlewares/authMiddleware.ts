// src/middlewares/authMiddleware.ts
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import SubAdmin from "../models/SubAdmin";
import { AuthRequest } from "../types/AuthRequest";

interface JwtPayload {
  id: string;
  role?: "superadmin" | "subadmin" | "user";
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    let authenticatedUser;

    // First try User model (normal users + superadmins)
    authenticatedUser = await User.findById(decoded.id).select("email role association");

    // If not found in User, try SubAdmin model
    if (!authenticatedUser) {
      authenticatedUser = await SubAdmin.findById(decoded.id).select("email role association");
    }

    if (!authenticatedUser) {
      return res.status(401).json({ message: "User/Subadmin not found" });
    }

    req.user = {
      id: decoded.id,
      role: authenticatedUser.role || "user",
      email: authenticatedUser.email,
      association: authenticatedUser.association,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};