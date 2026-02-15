import { Request, Response } from "express";
import User from "../models/User";
import crypto from "crypto"; 
import bcrypt from "bcryptjs"

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  user.resetToken = resetToken;
user.resetTokenExpiry = new Date(Date.now() + 3600000);

  await user.save();

  // send email with link
  // FRONTEND_URL/reset-password/:token

  res.json({ message: "Reset link sent" });
};
export const resetPassword = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }


const hashed = await bcrypt.hash(newPassword, 10);
user.password = hashed;
user.set({
  resetToken: undefined,
  resetTokenExpiry: undefined
});

  await user.save();

  res.json({ message: "Password reset successful" });
};

