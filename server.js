"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api/users", userRoutes_1.default);
app.use("/api/payments", paymentRoutes_1.default);
mongoose_1.default.connect(config_1.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));
app.listen(config_1.PORT, () => console.log(`Server running on port ${config_1.PORT}`));
//# sourceMappingURL=server.js.map