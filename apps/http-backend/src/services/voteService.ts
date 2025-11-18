import { prismaClient } from "@repo/db/client";
import { redis } from "../middleware/redis";

const VOTE_KEY_PREFIX = "poll:votes:";
const POLL_CACHE_PREFIX = "poll:data:";

const SCAN_BATCH_SIZE = 100; 

export class VoteService {

  private static async scanAllKeys(pattern: string): Promise<string[]> {
    let cursor = "0";
    let keys: string[] = [];

    do {
      const [newCursor, matchedKeys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_BATCH_SIZE
      );
      
      cursor = newCursor;
      if (matchedKeys.length > 0) {
        keys.push(...matchedKeys);
      }
    } while (cursor !== "0");

    return keys;
  }

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
    const keys = await this.scanAllKeys(`${VOTE_KEY_PREFIX}*`);

    if (keys.length === 0) return;

    console.log(` Syncing ${keys.length} active vote counters...`);


    await Promise.all(keys.map(async (key) => {
        const optionId = key.replace(VOTE_KEY_PREFIX, "");
  
        const currentVotes = await redis.get(key);
        const votesToSync = currentVotes ? parseInt(currentVotes) : 0;

        if (votesToSync === 0) return;

        try {

            await prismaClient.option.update({
                where: { id: optionId },
                data: { votes: { increment: votesToSync } },
            });

            await redis.decrby(key, votesToSync);
            
        } catch (error) {
            console.error(`Failed to sync ${optionId}, retrying next cycle.`);
        }
    }));
  }

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

    const result = await prismaClient.option.aggregate({
      _sum: { votes: true },
    });
    let totalVotes = result._sum.votes || 0;

    const voteKeys = await this.scanAllKeys(`${VOTE_KEY_PREFIX}*`);
    
    if (voteKeys.length > 0) {

        const values = await redis.mget(voteKeys);
        
        const pendingTotal = values.reduce((sum, val) => {
            return sum + (val ? parseInt(val) : 0);
        }, 0);
        
        totalVotes += pendingTotal;
    }

    return totalVotes;
  }
}