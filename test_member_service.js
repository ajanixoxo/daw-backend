const mongoose = require("mongoose");
require("dotenv").config();
require("module-alias/register");

// Import models to ensure schemas are registered
const Member = require("./src/models/memberModel/member.model");
const Cooperative = require("./src/models/cooperativeModel/cooperative.model");
const User = require("./src/models/userModel/user");
const SubscriptionTier = require("./src/models/subscriptionTierModel/subscriptionTier.model");

// Import Service
const MemberService = require("./src/services/member.service");

async function testGetMembers() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to DB\n");
    
    // Get DAW cooperative
    const coop = await Cooperative.findOne({ name: "DAW" });
    if (!coop) {
      console.log("DAW cooperative not found");
      return;
    }
    console.log(`Testing with Cooperative ID: ${coop._id}`);
    
    // Call the service method directly
    console.log("Calling MemberService.getMembers...");
    const members = await MemberService.getMembers(coop._id);
    
    console.log(`Result: Found ${members.length} members`);
    
    if (members.length > 0) {
      const m = members[0];
      console.log("\nSample Member:");
      console.log(`- Member ID: ${m._id}`);
      console.log(`- User populated? ${m.userId && m.userId.email ? "Yes" : "No"}`);
      if(m.userId) {console.log(`  User Email: ${m.userId.email}`);}
      console.log(`- Tier populated? ${m.subscriptionTierId && m.subscriptionTierId.name ? "Yes" : "No"}`);
      if(m.subscriptionTierId) {console.log(`  Tier Name: ${m.subscriptionTierId.name}`);}
    } else {
      // Check raw count if service returns 0
      const count = await Member.countDocuments({ cooperativeId: coop._id });
      console.log(`\nDirect DB Count: ${count}`);
    }
    
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected");
  }
}

testGetMembers();
