"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMember } from "@/lib/api/members";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const addMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  dob: z.string().optional(),
});
type AddMemberFormValues = z.infer<typeof addMemberSchema>;

export default function AddMemberPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", password: "", phone: "", gender: "MALE", bloodGroup: "", address: "", emergencyContact: "", dob: ""
    }
  });

  const mutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member created successfully!");
      router.push("/admin/members");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create member");
    }
  });

  const onSubmit = (data: AddMemberFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/members" className="p-2 rounded-xl glass-panel hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-brand-gold" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Member</h1>
          <p className="text-muted-foreground">Register a new member into the Lakzee system.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Account Details */}
        <fieldset disabled={mutation.isPending} className="space-y-8 group disabled:opacity-70 transition-opacity">
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Account Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">First Name <span className="text-brand-gold">*</span></label>
              <input {...register("firstName")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.firstName && <p className="text-red-500 text-xs">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Last Name <span className="text-brand-gold">*</span></label>
              <input {...register("lastName")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.lastName && <p className="text-red-500 text-xs">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email Address <span className="text-brand-gold">*</span></label>
              <input type="email" {...register("email")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Password <span className="text-brand-gold">*</span></label>
              <input type="password" {...register("password")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Personal Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <input type="tel" {...register("phone")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Gender</label>
              <select {...register("gender")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors appearance-none">
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <input type="date" {...register("dob")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
              <input placeholder="e.g. O+" {...register("bloodGroup")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Emergency Contact</label>
              <input {...register("emergencyContact")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Address</label>
              <textarea rows={3} {...register("address")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors resize-none"></textarea>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/admin/members" className="px-6 py-3 rounded-xl font-medium text-foreground hover:bg-white/5 transition-colors">
            Cancel
          </Link>
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all shadow-lg shadow-brand-gold/20 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {mutation.isPending ? "Saving..." : "Save Member"}
          </button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
