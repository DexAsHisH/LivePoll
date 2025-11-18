import { prismaClient } from "@repo/db/client";
import { redis } from "../middleware/redis";

const VOTE_KEY_PREFIX = "poll:votes:";
const POLL_CACHE_PREFIX = "poll:data:";
const CACHE_TTL = 3600; 

export class VoteService {
  static async recordVote(optionId: string): Promise<void> {
    const voteKey = `${VOTE_KEY_PREFIX}${optionId}`;
    await redis.incr(voteKey);
  }

  static async getPendingVotes(optionId: string): Promise<number> {
    const voteKey = `${VOTE_KEY_PREFIX}${optionId}`;
    const pending = await redis.get(voteKey);
    return pending ? parseInt(pending) : 0;
  }

  static async getPollWithCachedVotes(pollId: string) {
    const poll = await prismaClient.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });

    if (!poll) return null;
    for (const option of poll.options) {
      const pendingVotes = await this.getPendingVotes(option.id);
      option.votes += pendingVotes;
    }

    return poll;
  }
  static async getAllPollsWithCachedVotes() {
    const polls = await prismaClient.poll.findMany({
      include: { options: true },
      orderBy: { createdAt: "desc" },
    });
    for (const poll of polls) {
      for (const option of poll.options) {
        const pendingVotes = await this.getPendingVotes(option.id);
        option.votes += pendingVotes;
      }
    }

    return polls;
  }

  static async syncVotesToDatabase(): Promise<void> {
    const keys = await redis.keys(`${VOTE_KEY_PREFIX}*`); 
    if (keys.length === 0) return;

    await Promise.all(keys.map(async (key) => {
        const optionId = key.replace(VOTE_KEY_PREFIX, "");
        
        const currentVotes = await redis.get(key);
        const votesToSync = currentVotes ? parseInt(currentVotes) : 0;

        if (votesToSync === 0) return;

        try {
            // 2. SYNC: Update the database first
            await prismaClient.option.update({
                where: { id: optionId },
                data: { votes: { increment: votesToSync } },
            });

            // 3. DECREMENT: Safely remove ONLY what we synced
            // If new votes came in during step 2, they stay in Redis!
            await redis.decrby(key, votesToSync);

            console.log(`✅ Synced ${votesToSync} votes for ${optionId}`);
        } catch (error) {
            // If DB fails, we simply do nothing. 
            // The votes remain in Redis and will be picked up next time.
            // No complex restore logic needed!
            console.error(`Failed to sync ${optionId}, retrying next cycle.`);
        }
    }));
}
  // Clear Redis cache for a poll
  static async clearPollCache(pollId: string): Promise<void> {
    const cacheKey = `${POLL_CACHE_PREFIX}${pollId}`;
    await redis.del(cacheKey);
  }

  static async clearPollVotes(optionIds: string[]): Promise<void> {
    if (optionIds.length === 0) return;
    
    const voteKeys = optionIds.map(id => `${VOTE_KEY_PREFIX}${id}`);
    await redis.del(...voteKeys);
  }

  static async getTotalVotes(): Promise<number> {
    // Get votes from database
    const result = await prismaClient.option.aggregate({
      _sum: {
        votes: true,
      },
    });

    let totalVotes = result._sum.votes || 0;

    // Add pending votes from Redis
    const voteKeys = await redis.keys(`${VOTE_KEY_PREFIX}*`);
    for (const key of voteKeys) {
      const pendingVotes = await redis.get(key);
      if (pendingVotes) {
        totalVotes += parseInt(pendingVotes);
      }
    }

    return totalVotes;
  }
}