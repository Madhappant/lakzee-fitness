"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 'success') {
        localStorage.setItem('lakzee_token', data.data.token);
        localStorage.setItem('lakzee_user', JSON.stringify(data.data.user));
        
        if (data.data.user.role === 'MEMBER') {
          router.push("/member/dashboard");
        } else {
          router.push("/admin/dashboard");
        }
      } else {
        alert(data.message || 'Login failed');
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      alert('Network error. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background relative p-4">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="z-10 w-full max-w-md">
        <div className="glass-card p-8 md:p-10 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <img 
              src="/logo.png" 
              alt="Lakzee Fitness" 
              className="w-20 h-20 object-cover rounded-full bg-white mb-2 shadow-lg" 
            />
            <h1 className="text-2xl font-heading font-bold">Welcome Back</h1>
            <p className="text-sm text-muted-foreground font-body">
              Sign in to Lakzee Fitness Studio
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="admin@lakzee.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-primary text-primary-foreground font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all hover:bg-accent-hover hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-2 text-center text-sm text-muted-foreground">
            Protected by enterprise-grade security.
          </div>
        </div>
      </div>
    </main>
  );
}
