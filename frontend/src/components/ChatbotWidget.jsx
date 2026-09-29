import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, X, Send, Bot, Sparkles, AlertTriangle, 
  ExternalLink, RefreshCcw, Utensils, Train, ShieldAlert, ArrowRight
} from 'lucide-react';
import api from '../services/api';

const ChatbotWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      sender: 'bot', 
      text: "👋 Hi! I'm **RailBot**, your intelligent AI Assistant.\nHow can I help you with your journey today?",
      quickActions: [
        { label: 'Check PNR Status', route: '/passenger/pnr' },
        { label: 'Order Seat Meals', route: '/passenger/catering' },
        { label: 'Track Live Train', route: '/passenger/track' }
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    // Append user message
    setMessages(prev => [...prev, { sender: 'user', text }]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await api.post('/ai/chatbot', { message: text, history: messages });
      setMessages(prev => [
        ...prev, 
        { 
          sender: 'bot', 
          text: response.data.reply,
          quickActions: response.data.quickActions,
          suggestions: response.data.suggestedQuestions 
        }
      ]);
    } catch (err) {
      console.error('Chatbot request error:', err);
      const pnrMatch = text.match(/\b\d{10}\b/);
      if (pnrMatch) {
        const pnr = pnrMatch[0];
        setMessages(prev => [
          ...prev, 
          { 
            sender: 'bot', 
            text: `🔍 **PNR Status Inquiry: ${pnr}**\n\nYou can verify the real-time reservation status, coach/berth allocation, and passenger chart directly on the PNR Status page.`,
            quickActions: [
              { label: `View PNR ${pnr} Status`, route: `/passenger/pnr?pnr=${pnr}` },
              { label: 'View My Bookings', route: '/passenger/bookings' }
            ]
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev, 
          { 
            sender: 'bot', 
            text: 'I can assist you with your journey! Use the options below to check PNR status, order meals, or track live trains.',
            quickActions: [
              { label: 'Check PNR Status', route: '/passenger/pnr' },
              { label: 'Order Seat Meals', route: '/passenger/catering' },
              { label: 'Track Live Train', route: '/passenger/track' }
            ]
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleActionClick = (actionItem) => {
    if (actionItem.route) {
      navigate(actionItem.route);
      setIsOpen(false);
    } else if (actionItem.action === 'trigger_sos') {
      navigate('/passenger/pnr');
      setIsOpen(false);
    }
  };

  // Basic markdown formatter helper for bold text & bullets
  const renderFormattedText = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, idx) => {
      let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <p key={idx} className={line.startsWith('•') || line.startsWith('1.') ? 'ml-2 my-0.5' : 'my-0.5'} 
           dangerouslySetInnerHTML={{ __html: formattedLine }} 
        />
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl shadow-slate-900/40 transition-all duration-300 hover:scale-110 hover:bg-slate-800 active:scale-95 border-2 border-primary-400"
          title="Open RailBot AI Assistant"
        >
          <Bot className="h-7 w-7 text-primary-400 group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="flex h-[540px] w-96 max-w-[92vw] flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all overflow-hidden animate-scale-in">
          
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
            <div className="flex items-center space-x-3">
              <div className="rounded-2xl bg-primary-600/30 border border-primary-500/40 p-2 text-primary-400">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="font-black text-sm text-white">RailBot AI Assistant</h3>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Operations & Concierge</p>
              </div>
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-slate-900 text-white rounded-br-none shadow-md font-medium' 
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm space-y-2'
                }`}>
                  
                  <div>{renderFormattedText(msg.text)}</div>

                  {/* Interactive Quick Action Buttons inside message */}
                  {msg.quickActions && msg.quickActions.length > 0 && (
                    <div className="pt-2 flex flex-col gap-1.5">
                      {msg.quickActions.map((qa, qaIdx) => (
                        <button
                          key={qaIdx}
                          onClick={() => handleActionClick(qa)}
                          className="w-full flex items-center justify-between rounded-xl bg-slate-100 hover:bg-primary-50 border border-slate-200 hover:border-primary-300 px-3 py-2 text-xs font-bold text-slate-800 hover:text-primary-900 transition active:scale-[0.98]"
                        >
                          <span>{qa.label}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-primary-600" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggested Question Chips */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5 border-t border-slate-100 mt-2">
                      <span className="text-[10px] font-bold text-slate-400 w-full uppercase">Suggested:</span>
                      {msg.suggestions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => handleSendMessage(q)}
                          className="rounded-full bg-primary-50 hover:bg-primary-100 border border-primary-200/60 px-3 py-1 text-[11px] font-bold text-primary-900 transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs shadow-sm flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 animate-spin text-primary-600" />
                  <span className="font-bold">RailBot is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/10 transition">
              <input
                type="text"
                placeholder="Ask RailBot (PNR, Food, Tracking, SOS)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || loading}
                className={`rounded-xl p-2 transition ${
                  input.trim() && !loading ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95' : 'text-slate-300'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default ChatbotWidget;
