export interface Option {
  id: string;
  text: string;
  votes: number;
  pollId: string;
}

export interface Poll {
  id: string;
  question: string;
  options: Option[];
  createdAt: string | Date;
  updatedAt: string | Date;
}


export interface CreatePollInput {
  question: string;
  options: Array<{
    text: string;
  }>;
}

export interface VoteInput {
  optionId: string;
}

export interface VoteResponse {
  message: string;
  option: Option;
  poll: Poll;
}

export interface PollStats {
  pollId: string;
  question: string;
  totalVotes: number;
  optionCount: number;
  createdAt: string | Date;
}

export interface TotalVotesResponse {
  totalVotes: number;
  timestamp: string;
}

export interface PollStatsResponse {
  totalVotesAcrossAllPolls: number;
  totalPolls: number;
  pollBreakdown: PollStats[];
  timestamp: string;
}