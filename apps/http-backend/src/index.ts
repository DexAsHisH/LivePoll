import express, { Request, Response } from "express";
import cors from "cors";
import { prismaClient } from "@repo/db/client";
import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import redisMiddleware, { redis } from "./middleware/redis";
import { VoteService } from "./services/voteService";

import type {
  Poll,
  CreatePollInput,
  VoteInput,
  VoteResponse,
  PollStats,
  TotalVotesResponse,
  PollStatsResponse,
} from "@repo/type-schema";

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'https://live-poll-phi.vercel.app',
  credentials: true
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL = 5000;

const VOTE_KEY_PREFIX = "votes:";

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");
  console.log(`Total connected clients: ${wss.clients.size}`);

  ws.on("message", (msg) => {
    console.log("Received from client:", msg.toString());
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    console.log(`Total connected clients: ${wss.clients.size}`);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.send(
    JSON.stringify({ type: "welcome", message: "Connected to WS server" })
  );
});

function broadcast(data: any) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

setInterval(async () => {
  await VoteService.syncVotesToDatabase();
}, SYNC_INTERVAL);

app.get("/polls", async (req: Request, res: Response<Poll[]>) => {
  try {
    const polls = await VoteService.getAllPollsWithCachedVotes();
    res.json(polls);
  } catch (error) {
    console.error("Error fetching polls:", error);
    res.status(500).json({ error: "Failed to fetch polls" } as any);
  }
});

app.get(
  "/polls/:id",
  async (req: Request<{ id: string }>, res: Response<Poll>) => {
    try {
      const { id } = req.params;
      const poll = await VoteService.getPollWithCachedVotes(id);

      if (!poll) {
        return res.status(404).json({ error: "Poll not found" } as any);
      }

      res.json(poll);
    } catch (error) {
      console.error("Error fetching poll:", error);
      res.status(500).json({ error: "Failed to fetch poll" } as any);
    }
  }
);

app.post(
  "/polls",
  async (req: Request<{}, Poll, CreatePollInput>, res: Response<Poll>) => {
    try {
      const { question, options }: CreatePollInput = req.body;

      if (!question || typeof question !== "string") {
        return res
          .status(400)
          .json({ error: "Question is required and must be a string" } as any);
      }

      if (!options || !Array.isArray(options) || options.length < 2) {
        return res
          .status(400)
          .json({ error: "At least 2 options are required" } as any);
      }

      for (const option of options) {
        if (!option.text || typeof option.text !== "string") {
          return res
            .status(400)
            .json({ error: "Each option must have a text field" } as any);
        }
      }

      const poll = await prismaClient.poll.create({
        data: {
          question,
          options: {
            create: options.map((option) => ({
              text: option.text,
              votes: 0,
            })),
          },
        },
        include: {
          options: true,
        },
      });

      // Broadcast new poll to all connected clients
      broadcast({
        type: "NEW_POLL",
        data: poll,
      });

      res.status(201).json(poll);
    } catch (error) {
      console.error("Error creating poll:", error);
      res.status(500).json({ error: "Failed to create poll" } as any);
    }
  }
);

app.post(
  "/votes",
  async (
    req: Request<{}, VoteResponse, VoteInput>,
    res: Response<VoteResponse>
  ) => {
    try {
      const { optionId }: VoteInput = req.body;

      if (!optionId || typeof optionId !== "string") {
        return res.status(400).json({ error: "Option ID is required" } as any);
      }

      await VoteService.recordVote(optionId);

      const option = await prismaClient.option.findUnique({
        where: { id: optionId },
        select: { 
          id: true, 
          text: true, 
          votes: true, 
          pollId: true 
        }
      });

      if (!option) {
        await redis.decr(`${VOTE_KEY_PREFIX}${optionId}`);
        return res.status(404).json({ error: "Option not found" } as any);
      }

      const pendingVotes = await VoteService.getPendingVotes(optionId);
      const totalVotes = option.votes + pendingVotes;

      const response = {
        message: "Vote recorded successfully",
        option: {
          id: option.id,
          text: option.text,
          votes: totalVotes,
          pollId: option.pollId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        poll: null as any, 
      };

      broadcast({
        type: "VOTE_UPDATE",
        data: {
          optionId: option.id,
          pollId: option.pollId,
          votes: totalVotes,
        },
      });
      res.status(201).json(response);
    } catch (error) {
      console.error("Error recording vote:", error);
      res.status(500).json({ error: "Failed to record vote" } as any);
    }
  }
);

app.get(
  "/stats/total-votes",
  async (req: Request, res: Response<TotalVotesResponse>) => {
    try {
      const totalVotes = await VoteService.getTotalVotes();

      res.json({
        totalVotes,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching total votes:", error);
      res.status(500).json({ error: "Failed to fetch total votes" } as any);
    }
  }
);

app.get(
  "/stats/polls",
  async (req: Request, res: Response<PollStatsResponse>) => {
    try {
      const polls = await VoteService.getAllPollsWithCachedVotes();

      const pollStats: PollStats[] = polls.map((poll: { options: any[]; id: any; question: any; createdAt: any; }) => {
        const totalVotes = poll.options.reduce(
          (sum, option) => sum + option.votes,
          0
        );
        return {
          pollId: poll.id,
          question: poll.question,
          totalVotes,
          optionCount: poll.options.length,
          createdAt: poll.createdAt,
        };
      });

      const grandTotal = pollStats.reduce(
        (sum, poll) => sum + poll.totalVotes,
        0
      );

      res.json({
        totalVotesAcrossAllPolls: grandTotal,
        totalPolls: polls.length,
        pollBreakdown: pollStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching poll stats:", error);
      res.status(500).json({ error: "Failed to fetch poll stats" } as any);
    }
  }
);

app.delete(
  "/polls/:id",
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;

      // Get poll to find all option IDs
      const poll = await prismaClient.poll.findUnique({
        where: { id },
        include: { options: true },
      });

      if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
      }
      const optionIds = poll.options.map((opt: { id: any; }) => opt.id);
      await VoteService.clearPollVotes(optionIds);

      // Delete from database
      await prismaClient.option.deleteMany({
        where: { pollId: id },
      });

      const deletedPoll = await prismaClient.poll.delete({
        where: { id },
      });
      broadcast({
        type: "POLL_DELETED",
        data: { pollId: id },
      });

      res.json({ message: "Poll deleted successfully", poll: deletedPoll });
    } catch (error) {
      console.error("Error deleting poll:", error);
      res.status(500).json({ error: "Failed to delete poll" });
    }
  }
);

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    redis: redis.status,
  });
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, syncing votes before shutdown...");
  await VoteService.syncVotesToDatabase();
  redis.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, syncing votes before shutdown...");
  await VoteService.syncVotesToDatabase();
  redis.disconnect();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});