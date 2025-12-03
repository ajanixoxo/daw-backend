const cron = require("node-cron");
const Member = require("../models/memberModel/member.model.js");
const ContributionService = require("../services/contribution.service.js");

/**
 * Cron goals:
 * - Run on 1st of every month at 00:05 and create pending contribution records
 *   for all active members (if not already created for that month).
 *
 * Cron expression: minute hour day month day-of-week
 * '5 0 1 * *' -> at 00:05 on day-of-month 1
 */

function startCronJobs() {
  cron.schedule("5 0 1 * *", async () => {
    try {
      console.log("Monthly contribution cron started");
      const activeMembers = await Member.find({ status: "active" }).lean();
      await ContributionService.generateMonthlyForAll(activeMembers);
      console.log("Monthly contribution cron completed");
    } catch (err) {
      console.error("Cron error:", err);
    }
  });
}

module.exports = { startCronJobs };
