// inside src/controllers/userController.ts (registerUser)
export const registerUser = async (req, res) => {
  const { name, email, password, matric, department, phone, level } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name, email, password: hashedPassword, matric, department, phone, level
    });
    await user.save();
    // don't send password back
    const u = user.toObject();
    delete u.password;
    res.status(201).json({ message: "User registered successfully", user: u });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
