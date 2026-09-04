"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  
  // Refs for closures
  const messagesRef = useRef(messages);
  const transcriptRef = useRef(transcript);
  const isListeningRef = useRef(isListening);
  
  useEffect(() => {
    messagesRef.current = messages;
    transcriptRef.current = transcript;
    isListeningRef.current = isListening;
  }, [messages, transcript, isListening]);

  // Drag State
  const [position, setPosition] = useState({ x: -24, y: -24 });
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  const dragTimeout = useRef<any>(null);

  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    audioPlayerRef.current = new Audio(); // Create audio element on mount
    
    let savedPos = { x: -24, y: -24 };
    const saved = localStorage.getItem('lakzee-ai-pos');
    if (saved) {
      try { savedPos = JSON.parse(saved); setPosition(savedPos); } catch (e) {}
    }

    const handleResize = () => {
      setPosition(prev => {
        const btnSize = 56;
        const padding = 10;
        const minX = -(window.innerWidth - btnSize - padding);
        const minY = -(window.innerHeight - btnSize - padding);
        
        let newX = prev.x;
        let newY = prev.y;
        
        if (newX > -padding) newX = -padding;
        if (newX < minX) newX = minX;
        if (newY > -padding) newY = -padding;
        if (newY < minY) newY = minY;
        
        return { x: newX, y: newY };
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Using useCallback for handleCommand so it can be used inside the recognition effect safely without stale state
  const speak = useCallback((text: string) => {
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
  }, []);

  const handleCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    setIsThinking(true);
    const newMessages = [...messagesRef.current, { role: "user", content: text }];
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
        
        let audioPlayed = false;
        if (aiMessage.audio && aiMessage.audio.data && audioPlayerRef.current) {
          try {
            audioPlayerRef.current.src = `data:audio/mp3;base64,${aiMessage.audio.data}`;
            setIsSpeaking(true);
            audioPlayerRef.current.onended = () => setIsSpeaking(false);
            audioPlayerRef.current.onerror = () => setIsSpeaking(false);
            const playPromise = audioPlayerRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => console.error("Audio playback prevented:", e));
            }
            audioPlayed = true;
          } catch(e) { console.error("Audio play failed", e); }
        }

        // Handle frontend tool execution
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          setMessages(prev => [...prev, { role: "assistant", content: "Executing command..." }]);
          for (const call of aiMessage.tool_calls) {
            if (call.function.name === 'navigate_to_page') {
              try {
                const args = JSON.parse(call.function.arguments);
                const allowedPaths = ['/', '/pricing', '/about', '/contact', '/login'];
                if (args.path && allowedPaths.includes(args.path)) {
                  router.push(args.path);
                  if (!audioPlayed) speak("Navigating to " + args.path.replace('/', ''));
                } else {
                  if (!audioPlayed) speak("I cannot navigate to that page for security reasons.");
                }
              } catch (e) {
                console.error("Failed to parse tool args", e);
              }
            } else if (call.function.name === 'scroll_to_section') {
              try {
                const args = JSON.parse(call.function.arguments);
                const el = document.getElementById(args.sectionId);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                  if (!audioPlayed) speak("Scrolling to " + args.sectionId);
                } else {
                  if (!audioPlayed) speak("I couldn't find that section on this page.");
                }
              } catch (e) {
                console.error("Failed to parse tool args", e);
              }
            }
          }
        } 
        else if (aiMessage.content) {
          setMessages(prev => [...prev, { role: "assistant", content: aiMessage.content }]);
          if (!audioPlayed) speak(aiMessage.content);
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
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Stop after a single command
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let current = "";
          let isFinal = false;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            current += event.results[i][0].transcript;
            if (event.results[i].isFinal) isFinal = true;
          }
          
          setTranscript(current);
          
          // Some browsers fire isFinal correctly
          if (isFinal) {
            setIsListening(false);
            recognitionRef.current.stop();
            handleCommand(current);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          // If the recognition ends and we have a transcript but isFinal didn't trigger
          if (isListeningRef.current && transcriptRef.current.trim().length > 0) {
            setIsListening(false);
            handleCommand(transcriptRef.current);
          } else {
            setIsListening(false);
          }
        };
      }
    }
  }, [handleCommand]);

  const unlockAudio = () => {
    // Attempt to unlock audio playback context on iOS/Android
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play().catch(() => {});
      audioPlayerRef.current.pause();
    }
    if ('speechSynthesis' in window) {
       // Also initialize speech synthesis
       const u = new SpeechSynthesisUtterance('');
       u.volume = 0;
       window.speechSynthesis.speak(u);
    }
  };

  const toggleAssistant = () => {
    unlockAudio();
    if (!isOpen) {
      setIsOpen(true);
      startListening();
    } else {
      setIsOpen(false);
      stopEverything();
    }
  };

  const startListening = () => {
    unlockAudio();
    stopEverything();
    setTranscript("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    } else {
      console.warn("Speech recognition not supported");
    }
  };

  const stopEverything = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e){}
    }
    setIsListening(false);
    setIsThinking(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
  };

  // Pointer Drag Handlers
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
    
    dragTimeout.current = setTimeout(() => {
      setIsDragging(true);
      document.body.style.userSelect = 'none';
      document.body.style.overflow = 'hidden';
    }, 200);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) {
       // if moved > 5px before timeout, trigger drag instantly
       if (e.buttons && (Math.abs(e.clientX - dragStart.current.x) > 5 || Math.abs(e.clientY - dragStart.current.y) > 5)) {
          clearTimeout(dragTimeout.current);
          setIsDragging(true);
          document.body.style.userSelect = 'none';
          document.body.style.overflow = 'hidden';
       } else {
         return;
       }
    }
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    let newX = initialPos.current.x + dx;
    let newY = initialPos.current.y + dy;

    // Bounds check
    const btnSize = 56;
    const padding = 10;
    const minX = -(window.innerWidth - btnSize - padding);
    const minY = -(window.innerHeight - btnSize - padding);
    
    if (newX > -padding) newX = -padding;
    if (newX < minX) newX = minX;
    
    if (newY > -padding) newY = -padding;
    if (newY < minY) newY = minY;

    setPosition({ x: newX, y: newY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    clearTimeout(dragTimeout.current);
    document.body.style.userSelect = '';
    document.body.style.overflow = '';
    
    if (isDragging) {
      setTimeout(() => setIsDragging(false), 50);
      localStorage.setItem('lakzee-ai-pos', JSON.stringify(position));
    } else {
      toggleAssistant();
    }
  };

  if (!isMounted) return null;

  return (
    <div 
      className="fixed z-50 flex flex-col items-end pointer-events-none"
      style={{
        right: 0,
        bottom: 0,
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-72 md:w-80 glass-panel border border-brand-gold/30 rounded-2xl p-5 shadow-2xl backdrop-blur-xl bg-black/80 pointer-events-auto"
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all z-50 pointer-events-auto select-none touch-none ${
          isOpen ? 'bg-muted border border-border scale-90' : 'bg-brand-gold text-black'
        } ${isDragging ? 'scale-110 shadow-[0_0_20px_rgba(234,179,8,0.4)] cursor-grabbing' : 'cursor-grab hover:scale-110 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)]'}`}
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6" />}
      </button>
    </div>
  );
}
