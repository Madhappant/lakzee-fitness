"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
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
      localStorage.setItem("lakzee_token", data.data.token);
      localStorage.setItem("lakzee_user", JSON.stringify(data.data.user));

      toast.success("Signed in");

      if (data.data.user.role === "MEMBER") {
        router.push("/member/dashboard");
      } else {
        router.push("/admin/dashboard");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Sign in failed. Check your email and password.");
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ email, password });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl bg-card border border-border p-6 sm:p-8 flex flex-col gap-6 w-full">
          <div className="flex flex-col items-center gap-3 text-center">
            <Link href="/" className="focus-gold rounded-full">
              <Image
                src="/logo.jpg"
                alt="Lakzee Fitness Studio"
                width={72}
                height={72}
                className="w-16 h-16 object-cover rounded-full border border-brand-gold/50 bg-white"
                priority
              />
            </Link>
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-wide text-foreground">
                Sign in to Lakzee Fitness
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Access your training portal or studio dashboard
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg h-12 pl-10 pr-4 text-sm text-foreground focus-gold placeholder:text-muted-foreground/60 transition-all"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand-gold hover:underline font-medium focus-gold rounded"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg h-12 pl-10 pr-12 text-sm text-foreground focus-gold placeholder:text-muted-foreground/60 transition-all"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-lg focus-gold"
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
              className="mt-2 h-12 w-full rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus-gold touch-target disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mutation.isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="pt-4 border-t border-border text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-gold rounded">
              Back to studio home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
