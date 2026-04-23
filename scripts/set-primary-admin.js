const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../src/models/userModel/user.js");

dotenv.config();

const setPrimaryAdmin = async (adminId) => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");

    // 1. Unset any existing primary admin (to ensure only one exists)
    await User.updateMany({ isPrimaryAdmin: true }, { isPrimaryAdmin: false });

    // 2. Set the new primary admin
    const updatedUser = await User.findByIdAndUpdate(
      adminId,
      { isPrimaryAdmin: true },
      { new: true }
    );

    if (updatedUser) {
      console.log(`Successfully marked user ${updatedUser.firstName} ${updatedUser.lastName} (${adminId}) as Primary Admin.`);
    } else {
      console.error(`User with ID ${adminId} not found.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error setting primary admin:", err.message);
    process.exit(1);
  }
};

const adminId = process.argv[2] || "697b775e6e1a5775e66aac05";
setPrimaryAdmin(adminId);
