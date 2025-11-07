import { useState, useEffect, useRef } from "react";
import { Plus, BarChart3, X } from "lucide-react";
import axios from "axios";
import CreatePoll from "./CreatePoll";
import ActivePolls from "./ActivePolls";
import type { Poll } from "@repo/type-schema";

const Home = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://localhost:3000';

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log(' WebSocket connected');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received:', message);

          switch (message.type) {
            case 'welcome':
              console.log(message.message);
              break;

            case 'NEW_POLL':
              setPolls((prev) => {
                const exists = prev.some(p => p.id === message.data.id);
                if (exists) return prev;
                return [message.data, ...prev];
              });
              break;

            case 'VOTE_UPDATE':
              if (message.data.optionId && message.data.pollId) {
                setPolls((prev) =>
                  prev.map((poll) =>
                    poll.id === message.data.pollId
                      ? {
                          ...poll,
                          options: poll.options.map((opt) =>
                            opt.id === message.data.optionId
                              ? { ...opt, votes: message.data.votes }
                              : opt
                          ),
                        }
                      : poll
                  )
                );
              } else if (message.data.poll) {
                setPolls((prev) =>
                  prev.map((poll) =>
                    poll.id === message.data.poll.id ? message.data.poll : poll
                  )
                );
              }
              break;

            case 'POLL_DELETED':
              setPolls((prev) =>
                prev.filter((poll) => poll.id !== message.data.pollId)
              );
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error(' WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
    }
  };

  const fetchPolls = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/polls`);
      
      if (response.data && Array.isArray(response.data)) {
        setPolls(response.data);
      } else {
        setError('Invalid response format');
      }
    } catch (error) {
      console.error("Error fetching polls:", error);
      setError('Failed to fetch polls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  });

  const handleCreatePoll = async (newPoll: Poll) => {
    try {
      await axios.post(`${API_URL}/polls`, {
        question: newPoll.question,
        options: newPoll.options.map(option => ({ text: option.text }))
      });

      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create poll:', error);
      alert('Failed to create poll. Please try again.');
    }
  };

  const handleVote = async (_pollId: string, optionId: string) => {

    const response = await axios.post(`${API_URL}/votes`, {
      optionId
    });

    if (response.data?.option?.votes) {
      setPolls(prev =>
        prev.map(poll =>
          poll.options.some(opt => opt.id === optionId)
            ? {
                ...poll,
                options: poll.options.map(opt =>
                  opt.id === optionId
                    ? { ...opt, votes: response.data.option.votes }
                    : opt
                )
              }
            : poll
        )
      );
    }
  };

  const handleDelete = async (pollId: string) => {
    await axios.delete(`${API_URL}/polls/${pollId}`);
  };

  const totalVotes = polls.reduce((sum, poll) => 
    sum + poll.options.reduce((optionSum, option) => optionSum + option.votes, 0), 0
  );
  const avgVotesPerPoll = polls.length > 0 ? Math.round(totalVotes / polls.length) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading polls...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <button 
            onClick={fetchPolls}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{polls.length}</div>
                <div className="text-sm text-gray-600">Active Polls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{totalVotes}</div>
                <div className="text-sm text-gray-600">Total Votes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{avgVotesPerPoll}</div>
                <div className="text-sm text-gray-600">Avg per Poll</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          <div className="w-80 flex-shrink-0">
            {showCreateForm ? (
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Create New Poll</h3>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-1">
                  <CreatePoll onSubmit={handleCreatePoll} />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Plus className="text-blue-600" size={20} />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">Create a Poll</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Ask questions and collect responses from your audience in real-time
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1">
            {polls.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="text-gray-400" size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No polls created yet</h3>
                  <p className="text-gray-600 max-w-sm mx-auto mb-6">
                    Create your first poll to start collecting responses and engaging with your audience in real-time.
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Create Your First Poll
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">Your Polls</h2>
                    <p className="text-sm text-gray-600">
                      {polls.length} active {polls.length === 1 ? 'poll' : 'polls'} • Updates in real-time ⚡
                    </p>
                  </div>
                </div>
                <ActivePolls 
                  polls={polls} 
                  setPolls={setPolls}  
                  onVote={handleVote} 
                  onDelete={handleDelete} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;