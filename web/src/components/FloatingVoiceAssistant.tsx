"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FloatingVoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const router = useRouter();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Stop after a single command for a more assistant-like feel
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let current = "";
          let isFinal = false;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            current += event.results[i][0].transcript;
            if (event.results[i].isFinal) isFinal = true;
          }
          
          setTranscript(current);
          
          if (isFinal) {
            setIsListening(false);
            handleCommand(current);
          }
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

  const toggleAssistant = () => {
    if (!isOpen) {
      setIsOpen(true);
      startListening();
    } else {
      setIsOpen(false);
      stopEverything();
    }
  };

  const startListening = () => {
    stopEverything();
    setTranscript("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const stopEverything = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setIsThinking(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // Quick sanitization to remove markdown if any slipped through
    const cleanText = text.replace(/[*#_`~]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Try to find a natural female voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Google UK English Female") || v.name.includes("Samantha") || v.name.includes("Zira"));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.05; 
    utterance.pitch = 1.1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleCommand = async (text: string) => {
    if (!text.trim()) return;
    
    setIsThinking(true);
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    
    try {
      const { API_URL } = await import('@/lib/api/config');
      const res = await fetch(`${API_URL}/ai/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });
      
      const data = await res.json();
      
      if (data.status === 'success' && data.data?.choices?.[0]?.message) {
        const aiMessage = data.data.choices[0].message;
        
        // Handle frontend tool execution (Navigation)
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          for (const call of aiMessage.tool_calls) {
            if (call.function.name === 'navigate_to_page') {
              try {
                const args = JSON.parse(call.function.arguments);
                if (args.path) {
                  router.push(args.path);
                  speak("Navigating now.");
                }
              } catch (e) {
                console.error("Failed to parse tool args", e);
              }
            }
          }
        } 
        else if (aiMessage.content) {
          setMessages([...newMessages, { role: "assistant", content: aiMessage.content }]);
          speak(aiMessage.content);
        }
      } else {
        speak("I'm sorry, I encountered an error connecting to the servers.");
      }
    } catch (e) {
      console.error(e);
      speak("I'm sorry, I'm having trouble connecting right now.");
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-72 md:w-80 glass-panel border border-brand-gold/30 rounded-2xl p-5 shadow-2xl backdrop-blur-xl bg-black/80"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <img src="/logo.jpg" alt="Lakzee Logo" className="w-8 h-8 rounded-full object-cover border border-brand-gold/30" />
                <h3 className="font-bold text-brand-gold">
                  Lakzee AI
                </h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="min-h-[60px] flex flex-col justify-center items-center text-center">
              {isListening ? (
                <p className="text-white text-sm font-medium animate-pulse">{transcript || "Listening..."}</p>
              ) : isThinking ? (
                <div className="flex items-center gap-2 text-brand-gold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              ) : isSpeaking ? (
                <div className="flex items-center gap-2 text-green-400">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">Speaking...</span>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Tap the microphone to speak.</p>
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <button
                onClick={startListening}
                className={`p-4 rounded-full transition-all ${
                  isListening 
                    ? 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110' 
                    : 'bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 hover:scale-105'
                }`}
              >
                <Mic className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={toggleAssistant}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all z-50 ${
          isOpen ? 'bg-muted border border-border scale-90' : 'bg-brand-gold text-black hover:scale-110 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)]'
        }`}
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6" />}
      </button>
    </div>
  );
}
