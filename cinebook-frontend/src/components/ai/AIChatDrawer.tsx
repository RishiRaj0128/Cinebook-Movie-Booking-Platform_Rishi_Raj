import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Trash2, Bot, Film } from 'lucide-react';
import { AiChatMessage } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ChatMessageItem } from './ChatMessage';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie?: (title: string) => void;
}

const QUICK_PROMPTS = [
  'Find mind-bending sci-fi movies',
  'Recommend a romantic comedy for date night',
  'Show me IMAX shows in Mumbai',
  'Calculate ticket price for 2 premium seats',
];

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  onSelectMovie,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('cinebook_ai_session_id') || `sess_${Date.now()}`;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('cinebook_ai_session_id', sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (messages.length === 0) {
        setMessages([
          {
            role: 'assistant',
            content: `Hello ${user?.fullName ? user.fullName.split(' ')[0] : 'there'}! I am CineBook's AI Concierge. I can help you discover movies, find showtimes, inspect seat availability, or calculate booking quotes. What are you in the mood for today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMessage: AiChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.sendAiChatMessage({
        message: text,
        sessionId,
        userId: user?.id,
      });

      const assistantMessage: AiChatMessage = {
        role: 'assistant',
        content: response.reply,
        toolCalls: response.toolCalls,
        recommendedMovies: response.recommendedMovies,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if (response.sessionId) {
        setSessionId(response.sessionId);
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue processing your request. Please check if the AI service is reachable, or try rephrasing.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = () => {
    const newSessionId = `sess_${Date.now()}`;
    setSessionId(newSessionId);
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation history reset. How can I assist your movie discovery now?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          background: '#0d111c',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #161b2e 0%, #0d111c 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e50914, #ff5722)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 12px rgba(229, 9, 20, 0.4)',
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>
                  AI Concierge
                </h3>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Agentic RAG
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                Powered by LangGraph & Groq LLM
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleResetSession}
              title="Reset conversation"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 6,
                display: 'flex',
              }}
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              title="Close drawer"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#d1d5db',
                cursor: 'pointer',
                padding: 6,
                borderRadius: '50%',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {messages.map((msg, index) => (
            <ChatMessageItem
              key={index}
              message={msg}
              onSelectMovieTitle={onSelectMovie}
            />
          ))}

          {isLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#9ca3af',
                fontSize: '0.85rem',
                margin: '0.5rem 0 1rem 0',
                padding: '8px 14px',
                background: 'rgba(25, 30, 48, 0.6)',
                borderRadius: 12,
                width: 'fit-content',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <Sparkles size={16} className="animate-spin text-red-500" color="#e50914" />
              <span>Thinking & inspecting real showtimes...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 2 && (
          <div
            style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              background: '#0a0d17',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: '4px 10px',
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#121624',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 24,
              padding: '4px 6px 4px 16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for recommendations, showtimes, quotes..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: input.trim() && !isLoading ? '#e50914' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s ease',
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
