import express from "express";
import {
  getAllDues,
  createDue,
  updateDue,
  deleteDue,
  getAdminDues,
} from "../controllers/duesController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";
const router = express.Router();

const DEPARTMENTS = [
  "MICROBIOLOGY",
  "COMPUTER SCIENCE",
  "SCIENCE LABORATORY TECHNOLOGY",
  "INDUSTRIAL MATHEMATICS",
  "PLANT SCIENCE AND BIOTECH",
  "PHYSICS WITH ELECTRONICS",
  "HEALTH INFORMATION MANAGEMENT",
  "PUBLIC HEALTH",
  "BIOCHEMISTRY",
  "INDUSTRIAL CHEMISTRY",
  "OTHERS",
];

/**
 * PUBLIC – students
 * GET /api/dues
 */
router.get("/", getAllDues);

/**
 * ADMIN – manage dues
 */
router.post("/", authMiddleware, isSuperAdmin, createDue);
router.put("/:id", authMiddleware, isSuperAdmin, updateDue);
router.delete("/:id", authMiddleware, isSuperAdmin, deleteDue);
router.get("/admin", authMiddleware, isSuperAdmin, getAdminDues);

/**
 * Departments
 */
router.get("/departments/list", (req, res) => {
  res.status(200).json({ departments: DEPARTMENTS });
});

export default router;
