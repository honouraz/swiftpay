import mongoose from "mongoose";
import Due from "./src/models/Due";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGO_URI!);

const seed = async () => {
  await Due.deleteMany({});
  await Due.create([
    { name: "SUG Dues", amount: 5000, description: "Student Union Government dues" },
    { name: "NASS Dues", amount: 3000, description: "National Association dues" },
    { name: "Test Due", amount: 100, description: "Test payment" },
    { name: "Departmental Dues", amount: 2000, description: "Department fees" },
  ]);
  console.log("Dues seeded");
  process.exit();
};

seed();