// src/controllers/duesController.ts
import { Request, Response } from "express";
import Due from "../models/Due";

export const getAllDues = async (req: Request, res: Response) => {
  try {
    const dues = await Due.find().sort({ createdAt: -1 });
    res.status(200).json(dues);
  } catch (error) {
    res.status(500).json({ message: "Error fetching dues", error });
  }
};

export const createDue = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      prices,
      extraCharge = 0,
      platformFeePercent = 7,
    } = req.body;

    // FIX: If extraCharge > 0, set platformFeePercent to 0
    const finalPercent = extraCharge > 0 ? 0 : platformFeePercent;

    const due = await Due.create({
      name,
      description,
      prices,
      extraCharge,
      platformFeePercent: finalPercent,
    });

    res.status(201).json(due);
  } catch (error) {
    res.status(400).json({ message: "Error creating due", error });
  }
};

export const updateDue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, prices, extraCharge = 0, platformFeePercent = 7 } = req.body;

    // FIX: If extraCharge > 0, set platformFeePercent to 0
    const finalPercent = extraCharge > 0 ? 0 : platformFeePercent;

    const due = await Due.findByIdAndUpdate(
      id,
      { name, description, prices, extraCharge, platformFeePercent: finalPercent },
      { new: true }
    );

    if (!due) {
      return res.status(404).json({ message: "Due not found" });
    }

    res.status(200).json(due);
  } catch (error) {
    res.status(400).json({ message: "Error updating due", error });
  }
};

export const deleteDue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const due = await Due.findByIdAndDelete(id);
    if (!due) {
      return res.status(404).json({ message: "Due not found" });
    }

    res.status(200).json({ message: "Due deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting due", error });
  }
};
export const getAdminDues = async (req: Request, res: Response) => {
  const dues = await Due.find().sort({ createdAt: -1 });
  res.json(dues);
};
