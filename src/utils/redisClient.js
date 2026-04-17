// const redis = require("redis");
// // require("dotenv").config();

// const redisClient = redis.createClient({
//   url: process.env.REDIS_URL || "redis://localhost:6379"
// });

// redisClient.on("error", (err) => console.error("Redis Client Error", err));
// redisClient.on("connect", () => console.log("Redis Client Connected"));
// redisClient.on("ready", () => console.log("Redis Client Ready"));


// (async () => {
//   try {
//     await redisClient.connect();
//   } catch (err) {
//     console.error("Failed to connect to Redis", err);
//   }
// })();

// module.exports = redisClient;
