import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log(" Connected to Redis");
});

redis.on("error", (err) => {
  console.error(" Redis error:", err);
});

export { redis };

export default function redisMiddleware(req: any, res: any, next: any) {
  req.redis = redis;
  next();
}