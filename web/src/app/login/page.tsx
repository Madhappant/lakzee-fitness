"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowUpRight, ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUser } from "@/lib/api/auth";
import { fetchDashboardStats } from "@/lib/api/dashboard";
import { fetchMembers } from "@/lib/api/members";
import { fetchMyProfile, fetchMyAttendance } from "@/lib/api/portal";
import { clearPersistedQueryCache } from "@/lib/query-persistence";
import { useBranchScope } from "@/lib/branch-context";
import { toast } from "sonner";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshBranchScope } = useBranchScope();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    router.prefetch("/admin/dashboard");
    router.prefetch("/admin/members");
    router.prefetch("/member/dashboard");
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Mouse-tracking parallax motion values for the visual stage
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 24, mass: 0.8 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 24, mass: 0.8 });

  const photoX = useTransform(smoothX, [-0.5, 0.5], [-18, 18]);
  const photoY = useTransform(smoothY, [-0.5, 0.5], [-14, 14]);
  const reticleX = useTransform(smoothX, [-0.5, 0.5], [14, -14]);
  const reticleY = useTransform(smoothY, [-0.5, 0.5], [10, -10]);
  const kineticX = useTransform(smoothX, [-0.5, 0.5], [-26, 26]);

  // Magnetic micro-offset on primary CTA
  const magX = useMotionValue(0);
  const magY = useMotionValue(0);
  const smoothMagX = useSpring(magX, { stiffness: 220, damping: 18 });
  const smoothMagY = useSpring(magY, { stiffness: 220, damping: 18 });

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(nx);
    pointerY.set(ny);
  };

  const handleStageMouseLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const handleCtaMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion || !ctaRef.current || mutation.isPending) return;
    const rect = ctaRef.current.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left - rect.width / 2) * 0.12;
    const offsetY = (e.clientY - rect.top - rect.height / 2) * 0.18;
    magX.set(offsetX);
    magY.set(offsetY);
  };

  const handleCtaMouseLeave = () => {
    magX.set(0);
    magY.set(0);
  };

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      clearPersistedQueryCache();
      queryClient.clear();
      localStorage.setItem("lakzee_token", data.data.token);
      localStorage.setItem("lakzee_user", JSON.stringify(data.data.user));
      const nextBranch =
        data.data.user.role === "SUPER_ADMIN"
          ? "all"
          : data.data.user.branchId || "branch-primary-001";
      refreshBranchScope();

      toast.success("Signed in");

      if (data.data.user.role === "MEMBER") {
        void queryClient.prefetchQuery({ queryKey: ["myProfile"], queryFn: fetchMyProfile });
        void queryClient.prefetchQuery({ queryKey: ["myAttendance"], queryFn: fetchMyAttendance });
        router.push("/member/dashboard");
      } else {
        if (data.data.user.role !== "TRAINER") {
          void queryClient.prefetchQuery({
            queryKey: ["dashboardStats", nextBranch],
            queryFn: fetchDashboardStats,
          });
        }
        void queryClient.prefetchQuery({
          queryKey: ["members", nextBranch],
          queryFn: () => fetchMembers({ sort: "asc", limit: 100 }),
        });
        router.push(data.data.user.role === "TRAINER" ? "/admin/members" : "/admin/dashboard");
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

  const isEmailFloating = focusedField === "email" || email.length > 0;
  const isPasswordFloating = focusedField === "password" || password.length > 0;

  return (
    <main
      ref={stageRef}
      onMouseMove={handleStageMouseMove}
      onMouseLeave={handleStageMouseLeave}
      className="relative min-h-screen w-full overflow-hidden bg-[#0A0A0C] text-[#F5F5F7] grid grid-cols-1 lg:grid-cols-12"
    >
      {/* Background Immersive Gym Stage (Full-bleed on mobile behind card, 7 cols asymmetric visual left on desktop) */}
      <div className="absolute inset-0 lg:relative lg:col-span-7 overflow-hidden">
        {/* Parallax Gym Photograph Layer */}
        <motion.div
          style={shouldReduceMotion ? undefined : { x: photoX, y: photoY }}
          className="absolute inset-[-32px] will-change-transform"
        >
          <Image
            src="/gym-hero.jpg"
            alt="Lakzee Fitness Obsidian strength floor and calibrated barbell rack"
            fill
            preload
            sizes="(max-width: 1024px) 100vw, 62vw"
            className="object-cover object-center scale-105 opacity-60 lg:opacity-85 contrast-110"
          />
        </motion.div>

        {/* Moody Obsidian Gradients so Typography Pops */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/45 to-[#0A0A0C]/70"
        />
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#0A0A0C]/65 via-transparent to-[#0A0A0C]"
        />

        {/* Subtle Architectural Grid & Geometric Parallax Reticle */}
        <motion.div
          aria-hidden="true"
          style={shouldReduceMotion ? undefined : { x: reticleX, y: reticleY }}
          className="pointer-events-none hidden lg:block absolute inset-8 border border-[#F5F5F7]/[0.06] rounded-2xl"
        >
          <span className="absolute -top-px -left-px w-5 h-[2px] bg-[#D4FF00]" />
          <span className="absolute -top-px -left-px h-5 w-[2px] bg-[#D4FF00]" />
          <span className="absolute -bottom-px -right-px w-5 h-[2px] bg-[#F5F5F7]/30" />
          <span className="absolute -bottom-px -right-px h-5 w-[2px] bg-[#F5F5F7]/30" />
        </motion.div>

        {/* Kinetic Background Watermark Wordmark */}
        <motion.div
          aria-hidden="true"
          style={shouldReduceMotion ? undefined : { x: kineticX }}
          animate={
            shouldReduceMotion
              ? undefined
              : { opacity: [0.03, 0.055, 0.03] }
          }
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none hidden lg:flex absolute inset-x-0 top-[24%] select-none overflow-hidden justify-center"
        >
          <span className="font-display text-[11rem] xl:text-[14rem] font-extrabold uppercase tracking-[-0.04em] leading-none text-[#F5F5F7] whitespace-nowrap">
            LAKZEE
          </span>
        </motion.div>

        {/* Left Stage Editorial Choreography (Desktop & Wide Screens) */}
        <div className="relative z-10 hidden lg:flex flex-col justify-between h-full p-12 xl:p-16">
          {/* Top Brand Lockup */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            className="flex items-center justify-between"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-3.5 group focus-volt rounded-full pr-2"
            >
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-[#F5F5F7]/20 group-hover:border-[#D4FF00] transition-colors">
                <Image
                  src="/logo.jpg"
                  alt="Lakzee Fitness Studio"
                  fill
                  sizes="44px"
                  preload
                  className="object-cover"
                />
              </div>
              <div>
                <span className="font-display text-lg font-extrabold tracking-tight text-[#F5F5F7] block leading-none">
                  LAKZEE
                </span>
                <span className="font-mono-metric text-[10px] tracking-[0.2em] text-[#F5F5F7]/60 uppercase">
                  Studio OS
                </span>
              </div>
            </Link>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0A0A0C]/70 border border-[#F5F5F7]/10 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF00]" aria-hidden="true" />
              <span className="font-mono-metric text-[11px] text-[#F5F5F7]/75 tracking-wider uppercase">
                Obsidian Floor 01
              </span>
            </div>
          </motion.div>

          {/* Bottom Staggered Clip-Path Editorial Statement */}
          <div className="max-w-xl space-y-6">
            <motion.div
              initial={shouldReduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT_EXPO }}
              className="origin-left w-12 h-[2px] bg-[#D4FF00]"
            />

            <div className="overflow-hidden">
              <motion.h2
                initial={
                  shouldReduceMotion
                    ? false
                    : { y: "100%", clipPath: "inset(0 0 100% 0)" }
                }
                animate={{ y: "0%", clipPath: "inset(0 0 0% 0)" }}
                transition={{ duration: 0.75, delay: 0.15, ease: EASE_OUT_EXPO }}
                className="font-display text-5xl xl:text-6xl font-extrabold uppercase tracking-[-0.03em] leading-[0.95] text-[#F5F5F7]"
              >
                Built for
                <br />
                measured strength.
              </motion.h2>
            </div>

            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28, ease: EASE_OUT_EXPO }}
              className="text-base text-[#F5F5F7]/72 leading-relaxed max-w-[46ch]"
            >
              Unified access for Lakzee coaching staff and members — attendance passes, programming, and studio metrics in one precision interface.
            </motion.p>

            {/* Monospace Architectural Spec Footer */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.38, ease: EASE_OUT_EXPO }}
              className="pt-4 border-t border-[#F5F5F7]/10 grid grid-cols-3 gap-6"
            >
              <div>
                <p className="font-mono-metric text-xs text-[#D4FF00] font-bold">10,000+ SQ FT</p>
                <p className="text-xs text-[#F5F5F7]/55 mt-0.5">Training Floor</p>
              </div>
              <div>
                <p className="font-mono-metric text-xs text-[#F5F5F7] font-bold">05:30 – 22:00</p>
                <p className="text-xs text-[#F5F5F7]/55 mt-0.5">Mon – Sat Access</p>
              </div>
              <div>
                <p className="font-mono-metric text-xs text-[#F5F5F7] font-bold">QR + TELEMETRY</p>
                <p className="text-xs text-[#F5F5F7]/55 mt-0.5">Live Attendance</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Right Column: Floating Glassmorphic Auth Card */}
      <div className="relative z-20 lg:col-span-5 flex flex-col justify-center items-center px-4 py-10 sm:px-8 lg:px-10 xl:px-14 bg-transparent lg:bg-[#0A0A0C]">
        {/* Subtle Volt Radial Ambient Glow on Auth Edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none hidden lg:block absolute top-1/3 left-0 -translate-x-1/2 w-64 h-64 rounded-full bg-[#D4FF00]/[0.06] blur-[110px]"
        />

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12, ease: EASE_OUT_EXPO }}
          className="relative w-full max-w-[430px] rounded-2xl p-7 sm:p-9 obsidian-glass shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
        >
          {/* Architectural top Volt Lime edge bar */}
          <span
            aria-hidden="true"
            className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#D4FF00]/70 to-transparent"
          />

          {/* Compact Brand Header */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT_EXPO }}
            className="flex items-center justify-between mb-8"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-3 group focus-volt rounded-full pr-1"
            >
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-[#F5F5F7]/15 group-hover:border-[#D4FF00] transition-colors">
                <Image
                  src="/logo.jpg"
                  alt="Lakzee Fitness Studio"
                  fill
                  sizes="44px"
                  preload
                  className="object-cover"
                />
              </div>
              <div className="lg:hidden">
                <span className="font-display text-base font-extrabold tracking-tight text-[#F5F5F7] block">
                  LAKZEE
                </span>
                <span className="font-mono-metric text-[10px] text-[#F5F5F7]/55 uppercase tracking-widest">
                  Studio Portal
                </span>
              </div>
            </Link>

            <span className="font-mono-metric text-[11px] uppercase tracking-[0.16em] text-[#D4FF00] px-2.5 py-1 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/25">
              Portal Access
            </span>
          </motion.div>

          {/* Clip-Path Revealed Card Heading */}
          <div className="space-y-2 mb-8">
            <div className="overflow-hidden">
              <motion.h1
                initial={
                  shouldReduceMotion
                    ? false
                    : { y: "100%", clipPath: "inset(0 0 100% 0)" }
                }
                animate={{ y: "0%", clipPath: "inset(0 0 0% 0)" }}
                transition={{ duration: 0.65, delay: 0.24, ease: EASE_OUT_EXPO }}
                className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F5F5F7]"
              >
                Sign in
              </motion.h1>
            </div>
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32, ease: EASE_OUT_EXPO }}
              className="text-sm text-[#F5F5F7]/65"
            >
              Enter your studio credentials to open the training portal or dashboard.
            </motion.p>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Floating Label Email Field */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38, ease: EASE_OUT_EXPO }}
              className="relative"
            >
              <div
                className={`relative flex items-center rounded-xl bg-[#0A0A0C]/70 border transition-all duration-200 ${
                  focusedField === "email"
                    ? "border-[#D4FF00] shadow-[0_0_0_3px_rgba(212,255,0,0.18)]"
                    : "border-[#F5F5F7]/12 hover:border-[#F5F5F7]/25"
                }`}
              >
                <Mail
                  className={`ml-4 h-4 w-4 shrink-0 transition-colors ${
                    focusedField === "email" ? "text-[#D4FF00]" : "text-[#F5F5F7]/45"
                  }`}
                  aria-hidden="true"
                />
                <div className="relative flex-1 h-14">
                  <label
                    htmlFor="login-email"
                    className={`pointer-events-none absolute left-3 transition-all duration-200 font-medium ${
                      isEmailFloating
                        ? "top-2 text-[11px] tracking-wide"
                        : "top-1/2 -translate-y-1/2 text-sm"
                    } ${
                      focusedField === "email"
                        ? "text-[#D4FF00]"
                        : "text-[#F5F5F7]/60"
                    }`}
                  >
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-full bg-transparent pt-5 pb-1.5 pl-3 pr-4 text-sm text-[#F5F5F7] focus:outline-none"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
            </motion.div>

            {/* Floating Label Password Field */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.44, ease: EASE_OUT_EXPO }}
              className="space-y-2"
            >
              <div
                className={`relative flex items-center rounded-xl bg-[#0A0A0C]/70 border transition-all duration-200 ${
                  focusedField === "password"
                    ? "border-[#D4FF00] shadow-[0_0_0_3px_rgba(212,255,0,0.18)]"
                    : "border-[#F5F5F7]/12 hover:border-[#F5F5F7]/25"
                }`}
              >
                <Lock
                  className={`ml-4 h-4 w-4 shrink-0 transition-colors ${
                    focusedField === "password" ? "text-[#D4FF00]" : "text-[#F5F5F7]/45"
                  }`}
                  aria-hidden="true"
                />
                <div className="relative flex-1 h-14">
                  <label
                    htmlFor="login-password"
                    className={`pointer-events-none absolute left-3 transition-all duration-200 font-medium ${
                      isPasswordFloating
                        ? "top-2 text-[11px] tracking-wide"
                        : "top-1/2 -translate-y-1/2 text-sm"
                    } ${
                      focusedField === "password"
                        ? "text-[#D4FF00]"
                        : "text-[#F5F5F7]/60"
                    }`}
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-full bg-transparent pt-5 pb-1.5 pl-3 pr-2 text-sm text-[#F5F5F7] focus:outline-none"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="mr-1.5 touch-target rounded-lg text-[#F5F5F7]/55 hover:text-[#F5F5F7] transition-colors focus-volt"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#F5F5F7]/65 hover:text-[#D4FF00] transition-colors focus-volt rounded py-1"
                >
                  Forgot password?
                </Link>
              </div>
            </motion.div>

            {/* Magnetic + Smooth Fill Volt Lime Submit CTA */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: EASE_OUT_EXPO }}
              className="pt-1"
            >
              <motion.button
                ref={ctaRef}
                type="submit"
                disabled={mutation.isPending}
                onMouseMove={handleCtaMouseMove}
                onMouseLeave={handleCtaMouseLeave}
                style={shouldReduceMotion ? undefined : { x: smoothMagX, y: smoothMagY }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                className="group relative overflow-hidden h-14 w-full rounded-xl bg-[#D4FF00] text-[#0A0A0C] font-bold text-sm tracking-wide transition-shadow duration-300 hover:shadow-[0_0_32px_rgba(212,255,0,0.35)] focus-volt touch-target disabled:opacity-70"
              >
                {/* Smooth Chalk White wipe fill overlay on hover */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#F5F5F7] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
                />
                {/* Loading pulse shimmer bar */}
                {mutation.isPending && (
                  <motion.span
                    aria-hidden="true"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-1/3 bg-[#0A0A0C]/15 skew-x-[-20deg]"
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2 font-display font-extrabold uppercase tracking-wider text-sm">
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Authenticating
                    </>
                  ) : (
                    <>
                      Enter Studio
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          </form>

          {/* Footer Back Navigation */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.58 }}
            className="mt-7 pt-5 border-t border-[#F5F5F7]/10 flex items-center justify-between text-xs"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[#F5F5F7]/65 hover:text-[#F5F5F7] transition-colors focus-volt rounded py-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to studio home
            </Link>
            <span className="font-mono-metric text-[#F5F5F7]/40 text-[11px]">
              v2.0
            </span>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
