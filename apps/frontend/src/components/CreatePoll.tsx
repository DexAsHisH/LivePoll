import { Plus, X, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { Poll } from "@repo/type-schema";

const CreatePoll = ({ onSubmit }: { onSubmit: (poll: Poll) => void }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    

    if (error) setError(null);
  };

  const handleSubmit = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) return;

    setIsSubmitting(true);
    setError(null);

    try {
     
      const pollData: Poll = {
        id: '', 
        question: question.trim(),
        options: options
          .filter(opt => opt.trim())
          .map((text) => ({
            id: '',
            text: text.trim(),
            votes: 0,
            pollId: ''
          })),
        createdAt: new Date(),
        updatedAt: ""
      };
      await onSubmit(pollData);

      setQuestion("");
      setOptions(["", ""]);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to create poll:', err);
      setError((err instanceof Error) ? err.message : 'Failed to create poll. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, isLastOption: boolean) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLastOption && options.length < 6) {
        addOption();
      } else if (isValid) {
        handleSubmit();
      }
    }
  };

  const isValid = 
    question.trim().length > 0 && 
    options.filter(opt => opt.trim()).length >= 2 && 
    options.every(opt => opt.trim());

  return (
    <div className="p-5">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Poll Question
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (error) setError(null);
            }}
            onKeyPress={(e) => handleKeyPress(e, false)}
            placeholder="What would you like to ask?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            maxLength={200}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center mt-1">
            <div className="text-xs text-gray-500">
              {question.length}/200 characters
            </div>
            {question.length > 150 && (
              <div className="text-xs text-orange-600">
                {200 - question.length} remaining
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-900">
              Options
            </label>
            <span className="text-xs text-gray-500">
              {options.length}/6 options
            </span>
          </div>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, index === options.length - 1)}
                      placeholder={`Option ${index + 1}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      maxLength={100}
                      disabled={isSubmitting}
                    />
                    {option.length > 80 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {100 - option.length}
                      </div>
                    )}
                  </div>
                </div>
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={isSubmitting}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Remove option ${index + 1}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              disabled={isSubmitting}
              className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Option {options.length < 6 && `(${6 - options.length} remaining)`}
            </button>
          )}
          
          <p className="mt-2 text-xs text-gray-500">
            Press Enter to add another option
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2.5 px-4 rounded-md font-medium disabled:cursor-not-allowed transition-all hover:shadow-md active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Poll...
              </div>
            ) : (
              "Create Poll"
            )}
          </button>
          
          {!isValid && (
            <p className="mt-2 text-xs text-center text-gray-500">
              {!question.trim() 
                ? "Enter a question to continue" 
                : options.filter(opt => opt.trim()).length < 2
                ? "Add at least 2 options"
                : "Fill in all options"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePoll;