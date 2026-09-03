"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Sparkles, Settings2, ShieldCheck, Key } from "lucide-react";

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Hello! I'm your Lakzee AI Assistant. I can help you draft announcements, create workout plans, analyze gym data, or answer any questions you have. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("google/gemma-4-31b-it:free");
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          model,
          apiKey,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to get response");
      }

      const aiResponse = data.data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
      setMessages([...newMessages, { role: "assistant", content: aiResponse }]);

    } catch (error: any) {
      console.error(error);
      setMessages([...newMessages, { role: "assistant", content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-brand-gold" />
            Lakzee AI Assistant
          </h1>
          <p className="text-muted-foreground mt-1">Chat with our powerful AI models to automate your gym tasks.</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:border-brand-gold/50 transition-colors"
        >
          <Settings2 className="w-4 h-4 text-brand-gold" />
          Settings
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="glass-panel p-6 border border-brand-gold/30 rounded-xl overflow-hidden"
          >
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-gold" /> AI Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Select AI Model</label>
                <select 
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-brand-gold outline-none"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="google/gemma-4-31b-it:free">Google: Gemma 4 31B (Free)</option>
                  <option value="minimax/minimax-m3:free">MiniMax: M3 (Free)</option>
                  <option value="nvidia/nemotron-3-ultra-550b-a55b:free">NVIDIA: Nemotron 3 Ultra (Free)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Key className="w-4 h-4" /> OpenRouter API Key (Optional)
                </label>
                <input 
                  type="password"
                  placeholder="sk-or-v1-..."
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-brand-gold outline-none"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave blank if the server already has an API key configured.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 glass-panel border border-border rounded-xl flex flex-col overflow-hidden min-h-0">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-brand-gold" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-brand-gold text-primary-foreground rounded-tr-sm' 
                  : 'bg-muted/50 border border-border text-foreground rounded-tl-sm prose prose-invert max-w-none'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
                ))}
              </div>

              {msg.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4 justify-start"
            >
              <div className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-brand-gold" />
              </div>
              <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-brand-gold" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-card border-t border-border">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Ask the AI to create a workout plan, write an announcement, etc..." 
              className="w-full bg-background border border-border rounded-xl py-4 pl-4 pr-16 focus:border-brand-gold outline-none transition-colors"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-3 bg-brand-gold text-primary-foreground rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-brand-gold transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
