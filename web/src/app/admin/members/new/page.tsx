/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
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
  whatsappNumber: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^\+[1-9]\d{7,14}$/.test(val.replace(/[\s\-().]+/g, "")),
      "WhatsApp number must use E.164 format (e.g., +919876543210)"
    )
    .optional(),
  notificationsEnabled: z.boolean().optional(),
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
      firstName: "", lastName: "", email: "", password: "", phone: "", whatsappNumber: "", notificationsEnabled: true, gender: "MALE", bloodGroup: "", address: "", emergencyContact: "", dob: ""
    }
  });

  const mutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast.success("Member created successfully!");
      router.push("/admin/members");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create member");
    }
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
      setPhotoPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const onSubmit = (data: AddMemberFormValues) => {
    const payload = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        payload.append(key, String(value));
      } else if (value) {
        payload.append(key, value);
      }
    });
    if (photo) {
      payload.append('photo', photo);
    }
    mutation.mutate(payload);
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

        <fieldset disabled={mutation.isPending} className="space-y-8 group disabled:opacity-70 transition-opacity">
        {/* Profile Image */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Profile Image</h2>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-card/50 border border-border">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Upload photo</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-gold file:text-primary-foreground hover:file:bg-brand-gold/90 transition-colors cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Account Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">First Name <span className="text-brand-gold">*</span></label>
              <input {...register("firstName")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.firstName && <p className="font-mono-metric text-foreground/90 text-xs">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Last Name <span className="text-brand-gold">*</span></label>
              <input {...register("lastName")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.lastName && <p className="font-mono-metric text-foreground/90 text-xs">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email Address <span className="text-brand-gold">*</span></label>
              <input type="email" {...register("email")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.email && <p className="font-mono-metric text-foreground/90 text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Password <span className="text-brand-gold">*</span></label>
              <input type="password" {...register("password")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.password && <p className="font-mono-metric text-foreground/90 text-xs">{errors.password.message}</p>}
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
              <label className="text-sm font-medium text-muted-foreground">WhatsApp Number (E.164)</label>
              <input type="tel" placeholder="+919876543210" {...register("whatsappNumber")} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 font-mono-metric text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
              {errors.whatsappNumber && <p className="font-mono-metric text-foreground/90 text-xs">{errors.whatsappNumber.message}</p>}
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
            <div className="sm:col-span-2 flex items-center justify-between p-4 rounded-xl bg-secondary/40 border border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Automated Expiry Reminders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Allow scheduled WhatsApp and Email renewal reminders (7d, 3d, 1d, expired).</p>
              </div>
              <input
                type="checkbox"
                {...register("notificationsEnabled")}
                aria-label="Enable automated WhatsApp and Email expiry reminders"
                className="w-5 h-5 accent-[#D4FF00] cursor-pointer rounded"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/admin/members" className="touch-target px-6 rounded-xl font-medium text-foreground hover:bg-secondary border border-border transition-colors focus-volt">
            Cancel
          </Link>
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="touch-target gap-2 px-8 rounded-xl text-[#0A0A0C] bg-[#D4FF00] hover:brightness-105 font-bold transition-all volt-glow-sm focus-volt disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Save className="w-5 h-5" aria-hidden="true" />}
            {mutation.isPending ? "Saving..." : "Save Member"}
          </button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
