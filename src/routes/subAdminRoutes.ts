// src/routes/subAdminRoutes.ts
import express from "express";
import {
  getSubAdmins,
  createSubAdmin,
  getSubAdminPayments,
} from "../controllers/subAdminController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";

const router = express.Router();

// create subadmin
router.post("/create", authMiddleware, isSuperAdmin, createSubAdmin);

// list subadmins
router.get("/", authMiddleware, isSuperAdmin, getSubAdmins);

// subadmin payments (ANY authenticated subadmin/admin)
router.get("/payments", authMiddleware, getSubAdminPayments);

export default router;
