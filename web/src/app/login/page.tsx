"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { loginUser } from "@/lib/api/auth";
import { toast } from "sonner";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      localStorage.setItem('lakzee_token', data.data.token);
      localStorage.setItem('lakzee_user', JSON.stringify(data.data.user));
      
      toast.success("Welcome back!");
      
      if (data.data.user.role === 'MEMBER') {
        router.push("/member/dashboard");
      } else {
        router.push("/admin/dashboard");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Login failed');
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ email, password });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background relative p-4">
      {/* Background glow */}
      <div className="absolute w-[150vw] sm:w-[500px] aspect-square bg-primary/10 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none" />

      <div className="z-10 w-full max-w-md">
        <div className="glass-card p-6 sm:p-8 md:p-10 flex flex-col gap-6 w-full">
          <div className="flex flex-col items-center gap-2 text-center">
            <Image 
              src="/logo.jpg" 
              alt="Lakzee Fitness" 
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-full bg-white mb-2 shadow-lg" 
              priority
            />
            <h1 className="text-xl sm:text-2xl font-heading font-bold">Welcome Back</h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-body">
              Sign in to Lakzee Fitness Studio
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4 w-full">
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium text-foreground/80">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background/60 border border-border rounded-xl h-12 pl-11 pr-4 text-base text-foreground focus-gold placeholder:text-muted-foreground/60 transition-all"
                  placeholder="admin@lakzee.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-foreground/80">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-brand-gold hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background/60 border border-border rounded-xl h-12 pl-11 pr-12 text-base text-foreground focus-gold placeholder:text-muted-foreground/60 transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg focus-gold"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full mt-4 bg-gradient-to-r from-brand-gold to-yellow-500 text-black font-bold rounded-xl h-12 text-base flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-brand-gold/20 disabled:opacity-60 disabled:cursor-not-allowed focus-gold"
            >
              {mutation.isPending ? "Signing in..." : "Sign In"}
              {!mutation.isPending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>

          <div className="mt-2 text-center text-xs sm:text-sm text-muted-foreground">
            Protected by enterprise-grade security.
          </div>
        </div>
      </div>
    </main>
  );
}
