// src/routes/subAdminRoutes.ts
import express from "express";
import { createSubAdmin } from "../controllers/adminController";
import {
  getSubAdmins,
  getSubAdminPayments,
} from "../controllers/subAdminController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isSuperAdmin } from "../middlewares/isSuperAdmin";

const router = express.Router();

// create subadmin
router.post("/", authMiddleware, isSuperAdmin, createSubAdmin);

// list subadmins
router.get("/", authMiddleware, isSuperAdmin, getSubAdmins);

// subadmin payments (ANY authenticated subadmin/admin)
router.get("/payments", authMiddleware, getSubAdminPayments);

export default router;
