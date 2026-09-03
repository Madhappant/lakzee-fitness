"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Sparkles, Settings2, ShieldCheck, CheckCircle2, XCircle, Mic, Paperclip, X, Image as ImageIcon, Volume2, MicOff } from "lucide-react";

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type ChatMessage = { role: 'user' | 'assistant', content: string | ContentPart[] };

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your Lakzee AI Assistant. I can help you draft announcements, create workout plans, analyze gym data, or answer any questions you have. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("google/gemma-4-31b-it:free");
  const [showSettings, setShowSettings] = useState(false);
  const [configStatus, setConfigStatus] = useState<'loading' | 'configured' | 'not_configured'>('loading');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, selectedImage]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { API_URL } = await import('@/lib/api/config');
        const token = localStorage.getItem("lakzee_token");
        const res = await fetch(`${API_URL}/ai/status`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConfigStatus(data.configured ? 'configured' : 'not_configured');
        } else {
          setConfigStatus('not_configured');
        }
      } catch (error) {
        setConfigStatus('not_configured');
      }
    };
    checkStatus();

    // Initialize Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInput(prev => {
            // Very basic replacement for continuous typing
            const words = prev.split(' ');
            return currentTranscript; 
          });
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput(""); // clear input when starting dictation
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // If passed text is an error or empty, don't read
    if (!text || text.startsWith('Error:')) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;
    if (isListening) toggleListen();

    let userContent: string | ContentPart[] = input.trim();
    
    if (selectedImage) {
      userContent = [];
      if (input.trim()) userContent.push({ type: "text", text: input.trim() });
      userContent.push({ type: "image_url", image_url: { url: selectedImage } });
    }

    setInput("");
    setSelectedImage(null);
    
    const newMessages = [...messages, { role: "user" as const, content: userContent }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { API_URL } = await import('@/lib/api/config');
      const token = localStorage.getItem("lakzee_token");
      
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          model,
          messages: newMessages
        })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("AI_UPSTREAM_NON_JSON: AI provider returned an unexpected response.");
      }

      const data = await res.json();
      
      if (!res.ok || data.status === 'error') {
        const errorCode = data.code || `HTTP_${res.status}`;
        const errorMsg = data.message || "An error occurred.";
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      const aiResponse = data.data.choices?.[0]?.message?.content;
      if (!aiResponse) {
        throw new Error("AI_INVALID_RESPONSE: AI returned an empty or invalid response.");
      }
      
      setMessages([...newMessages, { role: "assistant", content: aiResponse }]);

    } catch (error: any) {
      console.error(error);
      setMessages([...newMessages, { 
        role: "assistant", 
        content: `Error: ${error.message || 'Unknown Error'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = (content: string | ContentPart[]) => {
    if (typeof content === 'string') {
      return content.split('\n').map((line, j) => (
        <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
      ));
    }
    
    return content.map((part, idx) => {
      if (part.type === 'text') {
        return part.text.split('\n').map((line, j) => (
          <p key={`txt-${idx}-${j}`} className={j > 0 ? 'mt-2' : ''}>{line}</p>
        ));
      }
      if (part.type === 'image_url') {
        return (
          <div key={`img-${idx}`} className="mt-3 relative rounded-lg overflow-hidden border border-border/50 max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={part.image_url.url} alt="Uploaded" className="w-full h-auto object-cover" />
          </div>
        );
      }
      return null;
    });
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
        <div className="flex gap-2">
          {isSpeaking && (
            <button 
              onClick={stopSpeaking}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Volume2 className="w-4 h-4 animate-pulse" />
              Stop Voice
            </button>
          )}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-4 py-2 bg-card border rounded-lg transition-colors ${showSettings ? 'border-brand-gold' : 'border-border hover:border-brand-gold/50'}`}
          >
            <Settings2 className="w-4 h-4 text-brand-gold" />
            Settings
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="glass-panel p-6 border border-brand-gold/30 rounded-xl overflow-hidden shrink-0"
          >
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-gold" /> AI Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Select AI Model</label>
                <select 
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-brand-gold outline-none"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="google/gemma-4-31b-it:free">Gemma 4 31B IT — Free</option>
                  <option value="minimax/minimax-m3:free">MiniMax M3 — Free</option>
                  <option value="nvidia/nemotron-3-ultra-550b-a55b:free">NVIDIA Nemotron 3 Ultra 550B — Free</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Connection Status</label>
                <div className="flex items-center gap-2 p-3 bg-background border border-border rounded-lg text-sm">
                  {configStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {configStatus === 'configured' && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>API Configuration: <strong className="text-green-500 font-semibold">Configured</strong></span>
                    </>
                  )}
                  {configStatus === 'not_configured' && (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span>API Configuration: <strong className="text-red-500 font-semibold">Not Configured</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 glass-panel border border-border rounded-xl flex flex-col overflow-hidden min-h-0 relative">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
          {messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-brand-gold" />
                  </div>
                  {typeof msg.content === 'string' && !msg.content.startsWith('Error:') && (
                    <button 
                      onClick={() => speakText(msg.content as string)}
                      className="p-2 text-muted-foreground hover:text-brand-gold transition-colors rounded-full hover:bg-brand-gold/10"
                      title="Read aloud"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-brand-gold text-primary-foreground rounded-tr-sm' 
                  : typeof msg.content === 'string' && msg.content.startsWith('Error:') 
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400 rounded-tl-sm'
                    : 'bg-muted/50 border border-border text-foreground rounded-tl-sm prose prose-invert max-w-none'
              }`}>
                {renderContent(msg.content)}
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
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-border">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage} alt="Selected" className="h-20 w-auto rounded-md border border-brand-gold/50" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          <form onSubmit={handleSend} className="relative flex items-center gap-2">
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 bg-muted border border-border rounded-xl text-muted-foreground hover:text-brand-gold hover:border-brand-gold/50 transition-colors"
              title="Upload Image"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Ask the AI to create a workout plan, or talk to it..." 
                className="w-full bg-background border border-border rounded-xl py-4 pl-4 pr-24 focus:border-brand-gold outline-none transition-colors"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={toggleListen}
                  className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-muted-foreground hover:bg-muted'}`}
                  title="Voice Type"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button 
                  type="submit"
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="p-2 bg-brand-gold text-primary-foreground rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-brand-gold transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
