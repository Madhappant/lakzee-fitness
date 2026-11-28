/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMemberById, updateMember, API_URL } from "@/lib/api/members";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = API_URL.replace("/api", "");

export default function EditMemberPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: memberData, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => fetchMemberById(id),
    enabled: !!id
  });

  const [formData, setFormData] = useState({
    memberId: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    whatsappNumber: "",
    notificationsEnabled: true,
    gender: "MALE",
    bloodGroup: "",
    address: "",
    emergencyContact: "",
    dob: "",
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (memberData?.data) {
      const { email, firstName, lastName, phone, memberProfile } = memberData.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        memberId: memberProfile?.memberId || "",
        firstName: firstName || "",
        lastName: lastName || "",
        email: email || "",
        password: "", // Keep password empty
        phone: phone || "",
        whatsappNumber: memberProfile?.whatsappNumber || "",
        notificationsEnabled: memberProfile?.notificationsEnabled ?? true,
        gender: memberProfile?.gender || "MALE",
        bloodGroup: memberProfile?.bloodGroup || "",
        address: memberProfile?.address || "",
        emergencyContact: memberProfile?.emergencyContact || "",
        dob: memberProfile?.dob && !isNaN(new Date(memberProfile.dob).getTime()) ? new Date(memberProfile.dob).toISOString().split('T')[0] : "",
      });
      if (memberProfile?.photoUrl) {
        const resolvedUrl = memberProfile.photoUrl.startsWith("http")
          ? memberProfile.photoUrl
          : `${BASE_URL}${memberProfile.photoUrl}`;
        setPhotoPreview(resolvedUrl);
      }
    }
  }, [memberData]);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const mutation = useMutation({
    mutationFn: (data: any) => updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast.success("Member updated successfully!");
      router.push("/admin/members");
    },
    onError: (err: any) => {
      const msg = err.message || "Something went wrong.";
      setError(msg);
      toast.error(msg);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
      setPhotoPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'password' && !value) return; // Skip empty password
      if (typeof value === 'boolean') {
        payload.append(key, String(value));
        return;
      }
      payload.append(key, String(value));
    });
    if (photo) {
      payload.append('photo', photo);
    }
    mutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/members" className="p-2 rounded-xl glass-panel hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-brand-gold" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Member</h1>
          <p className="text-muted-foreground">Update details for {memberData?.data?.firstName} {memberData?.data?.lastName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-secondary border border-border rounded-xl text-foreground font-medium text-sm">
            {error}
          </div>
        )}

        {/* Profile Image */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Profile Image</h2>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-card/50 border border-border">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl font-bold">
                  {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Upload new photo</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-gold file:text-primary-foreground hover:file:bg-brand-gold/90 transition-colors cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Account Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Member No. <span className="text-brand-gold">*</span></label>
              <input required name="memberId" value={formData.memberId} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors font-medium" placeholder="e.g. 101 or LZ-1234" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email Address <span className="text-brand-gold">*</span></label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">First Name <span className="text-brand-gold">*</span></label>
              <input required name="firstName" value={formData.firstName} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Last Name <span className="text-brand-gold">*</span></label>
              <input required name="lastName" value={formData.lastName} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">New Password (leave blank to keep current)</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" placeholder="••••••••" />
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Personal Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">WhatsApp Number (E.164)</label>
              <input type="tel" name="whatsappNumber" placeholder="+919876543210" value={formData.whatsappNumber} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 font-mono-metric text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors appearance-none">
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
              <input name="bloodGroup" placeholder="e.g. O+" value={formData.bloodGroup} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Emergency Contact</label>
              <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Address</label>
              <textarea name="address" rows={3} value={formData.address} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors resize-none"></textarea>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between p-4 rounded-xl bg-secondary/40 border border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Automated Expiry Reminders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Opt-in preference for automated WhatsApp & Email membership renewal alerts.</p>
              </div>
              <input
                type="checkbox"
                checked={formData.notificationsEnabled}
                onChange={(e) => setFormData((prev) => ({ ...prev, notificationsEnabled: e.target.checked }))}
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
            {mutation.isPending ? "Updating..." : "Update Member"}
          </button>
        </div>
      </form>
    </div>
  );
}
