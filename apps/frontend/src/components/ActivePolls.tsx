import { Users, MoreHorizontal, TrendingUp, Trash2, Eye } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Poll } from "@repo/type-schema";

const ActivePolls = ({
  polls,
  setPolls,
  onVote,
  onDelete,
}: {
  polls: Poll[];
  setPolls: React.Dispatch<React.SetStateAction<Poll[]>>;
  onVote: (pollId: string, optionId: string) => Promise<void>;
  onDelete?: (pollId: string) => Promise<void>;
}) => {
  const [selectedPoll, setSelectedPoll] = useState<string | null>(null);
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null);
  const [openMenuPollId, setOpenMenuPollId] = useState<string | null>(null);
  const [deletingPollId, setDeletingPollId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuPollId(null);
      }
    };

    if (openMenuPollId) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuPollId]);

  const handleVote = async (pollId: string, optionId: string) => {
    if (votingInProgress) return;

    setVotingInProgress(optionId);

    setPolls((prevPolls) =>
      prevPolls.map((poll) =>
        poll.id === pollId
          ? {
              ...poll,
              options: poll.options.map((opt) =>
                opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
              ),
            }
          : poll
      )
    );

    setTimeout(() => {
      setVotingInProgress(null);
    }, 300);

    try {
      await onVote(pollId, optionId);
    } catch (error) {
      console.error("Vote failed:", error);

      setPolls((prevPolls) =>
        prevPolls.map((poll) =>
          poll.id === pollId
            ? {
                ...poll,
                options: poll.options.map((opt) =>
                  opt.id === optionId
                    ? { ...opt, votes: Math.max(0, opt.votes - 1) }
                    : opt
                ),
              }
            : poll
        )
      );

      alert("Failed to record vote. Please try again.");
      setVotingInProgress(null);
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!onDelete) return;

    if (
      !confirm(
        "Are you sure you want to delete this poll? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingPollId(pollId);
    setOpenMenuPollId(null);

    const deletedPoll = polls.find((p) => p.id === pollId);
    setPolls((prevPolls) => prevPolls.filter((p) => p.id !== pollId));

    try {
      await onDelete(pollId);
    } catch (error) {
      console.error("Delete failed:", error);

      if (deletedPoll) {
        setPolls((prevPolls) =>
          [...prevPolls, deletedPoll].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      }

      alert("Failed to delete poll. Please try again.");
    } finally {
      setDeletingPollId(null);
    }
  };

  const toggleMenu = (pollId: string) => {
    setOpenMenuPollId(openMenuPollId === pollId ? null : pollId);
  };

  return (
    <div className="space-y-6">
      {polls.map((poll) => {
        const totalVotes = poll.options.reduce(
          (sum, option) => sum + option.votes,
          0
        );
        const isExpanded = selectedPoll === poll.id;
        const maxVotes = Math.max(...poll.options.map((opt) => opt.votes), 1);
        const isMenuOpen = openMenuPollId === poll.id;
        const isDeleting = deletingPollId === poll.id;

        return (
          <div
            key={poll.id}
            className={`border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-all duration-200 ${
              isDeleting ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="p-6 pb-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900 pr-4">
                  {poll.question}
                </h3>

                <div className="relative" ref={isMenuOpen ? menuRef : null}>
                  <button
                    onClick={() => toggleMenu(poll.id)}
                    className={`p-1 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0 ${
                      isMenuOpen ? "bg-gray-100" : ""
                    }`}
                    aria-label="Poll options"
                  >
                    <MoreHorizontal size={20} className="text-gray-400" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={() => {
                          setSelectedPoll(isExpanded ? null : poll.id);
                          setOpenMenuPollId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <Eye size={16} />
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>

                      {onDelete && (
                        <>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={() => handleDelete(poll.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                          >
                            <Trash2 size={16} />
                            Delete Poll
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Users size={14} />
                  <span className="font-medium">{totalVotes}</span>
                  <span>{totalVotes === 1 ? "vote" : "votes"}</span>
                </div>
                <span>•</span>
                <span>
                  {new Date(poll.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-3">
                {poll.options.map((option) => {
                  const votes = option.votes;
                  const percentage =
                    totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                  const isLeading =
                    votes === maxVotes && votes > 0 && totalVotes > 0;
                  const isVoting = votingInProgress === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleVote(poll.id, option.id)}
                      disabled={!!votingInProgress || isDeleting}
                      className="w-full group relative transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <div
                        className={`relative overflow-hidden flex items-center justify-between p-4 border rounded-lg transition-all ${
                          isVoting
                            ? "border-blue-400 bg-blue-50 shadow-sm"
                            : isLeading
                              ? "border-blue-200 bg-gradient-to-r from-blue-50 to-transparent hover:border-blue-300"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {totalVotes > 0 && (
                          <div
                            className={`absolute inset-0 transition-all duration-700 ease-out ${
                              isLeading
                                ? "bg-gradient-to-r from-blue-100/50 to-transparent"
                                : "bg-gray-100/50"
                            }`}
                            style={{
                              width: `${percentage}%`,
                              transformOrigin: "left",
                            }}
                          />
                        )}

                        <div className="flex items-center gap-3 flex-1 relative z-10">
                          <span
                            className={`font-medium transition-colors ${
                              isLeading ? "text-blue-900" : "text-gray-800"
                            }`}
                          >
                            {option.text}
                          </span>

                          {isVoting && (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                          )}

                          {isLeading && !isVoting && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                              <TrendingUp size={12} />
                              Leading
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm relative z-10">
                          <span
                            className={`transition-colors ${
                              isLeading
                                ? "text-blue-700 font-semibold"
                                : "text-gray-600"
                            }`}
                          >
                            {votes} {votes === 1 ? "vote" : "votes"}
                          </span>
                          <span
                            className={`font-semibold min-w-[3rem] text-right ${
                              isLeading ? "text-blue-700" : "text-gray-900"
                            }`}
                          >
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {totalVotes === 0 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  Be the first to vote! 🗳️
                </p>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <span className="text-gray-500 block mb-1">
                      Total Votes
                    </span>
                    <p className="font-semibold text-gray-900 text-lg">
                      {totalVotes}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Created</span>
                    <p className="font-medium text-gray-900">
                      {new Date(poll.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">
                      Leading Option
                    </span>
                    <p className="font-medium text-gray-900">
                      {totalVotes > 0
                        ? poll.options.find((opt) => opt.votes === maxVotes)
                            ?.text || "None"
                        : "No votes yet"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isDeleting && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-transparent"></div>
                  <span className="font-medium">Deleting...</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ActivePolls;
