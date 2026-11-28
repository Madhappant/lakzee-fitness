"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/lib/api/settings";
import { useBranchScope } from "@/lib/branch-context";
import { Save, Loader2, Building, Settings2, BellRing } from "lucide-react";

const MILESTONE_OPTIONS = [
  { day: "7", label: "7 Days Left" },
  { day: "3", label: "3 Days Left" },
  { day: "1", label: "1 Day Left" },
  { day: "0", label: "Expired Today" },
] as const;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { activeBranchId } = useBranchScope();
  const [formData, setFormData] = useState({
    gymName: "",
    branch: "",
    workingHours: "",
    gstNumber: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    whatsappRemindersEnabled: true,
    emailRemindersEnabled: true,
    reminderMilestones: "7,3,1,0",
  });
  
  const [successMessage, setSuccessMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["settings", activeBranchId],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (data?.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        gymName: data.data.gymName || "",
        branch: data.data.branch || "",
        workingHours: data.data.workingHours || "",
        gstNumber: data.data.gstNumber || "",
        contactEmail: data.data.contactEmail || "",
        contactPhone: data.data.contactPhone || "",
        address: data.data.address || "",
        whatsappRemindersEnabled: data.data.whatsappRemindersEnabled ?? true,
        emailRemindersEnabled: data.data.emailRemindersEnabled ?? true,
        reminderMilestones: data.data.reminderMilestones || "7,3,1,0",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSuccessMessage("Settings updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const activeMilestonesSet = new Set(
    (formData.reminderMilestones || "7,3,1,0")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const toggleMilestoneDay = (day: string) => {
    const next = new Set(activeMilestonesSet);
    if (next.has(day)) {
      if (next.size <= 1) return; // Require at least one active milestone
      next.delete(day);
    } else {
      next.add(day);
    }
    const ordered = ["7", "3", "1", "0"].filter((d) => next.has(d)).join(",");
    setFormData((prev) => ({ ...prev, reminderMilestones: ordered }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
          <Settings2 className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">Configure global parameters for Lakzee Fitness Studio.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset disabled={mutation.isPending} className="space-y-8 group disabled:opacity-70 transition-opacity">
        
        {/* Core Identity */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold flex items-center gap-2">
            <Building className="w-5 h-5" /> Gym Identity
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Gym Name</label>
              <input required name="gymName" value={formData.gymName} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Branch / Location Name</label>
              <input name="branch" value={formData.branch} onChange={handleChange} placeholder="e.g. Downtown Metro" className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">GST Identification Number</label>
              <input name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none font-mono uppercase transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Working Hours</label>
              <input name="workingHours" value={formData.workingHours} onChange={handleChange} placeholder="e.g. 5:00 AM - 11:00 PM" className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none transition-all" />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Contact Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Official Email</label>
              <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Support Phone</label>
              <input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none transition-all" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Complete Address</label>
              <textarea name="address" rows={3} value={formData.address} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus-gold outline-none transition-all resize-none"></textarea>
            </div>
          </div>
        </div>

        {/* Automated Expiry Reminders (Branch Scoped) */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-[#F2C14E] flex items-center gap-2">
            <BellRing className="w-5 h-5" aria-hidden="true" /> Automated Expiry Reminders
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-4 rounded-xl bg-secondary/40 border border-border cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-foreground">WhatsApp Reminders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Meta Cloud API / Webhook templates</p>
              </div>
              <input
                type="checkbox"
                checked={formData.whatsappRemindersEnabled}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, whatsappRemindersEnabled: e.target.checked }))
                }
                aria-label="Enable WhatsApp expiry reminders"
                className="w-5 h-5 accent-[#DBA12C] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl bg-secondary/40 border border-border cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-foreground">Email Reminders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Resend / SMTP renewal alerts</p>
              </div>
              <input
                type="checkbox"
                checked={formData.emailRemindersEnabled}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, emailRemindersEnabled: e.target.checked }))
                }
                aria-label="Enable Email expiry reminders"
                className="w-5 h-5 accent-[#DBA12C] cursor-pointer"
              />
            </label>
          </div>

          <div className="space-y-2.5">
            <p className="text-sm font-medium text-muted-foreground">Active Notification Milestones</p>
            <div className="flex flex-wrap gap-2">
              {MILESTONE_OPTIONS.map((opt) => {
                const selected = activeMilestonesSet.has(opt.day);
                return (
                  <button
                    key={opt.day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleMilestoneDay(opt.day)}
                    className={`touch-target px-4 rounded-xl text-xs font-mono-metric font-bold border transition-all focus-gold ${
                      selected
                        ? "bg-[#DBA12C] text-[#0A0A0C] border-[#DBA12C]"
                        : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-4">
          {successMessage && (
            <span role="status" aria-live="polite" className="text-[#F2C14E] font-medium text-sm mr-2">{successMessage}</span>
          )}
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] font-bold active:scale-[0.98] transition-all duration-200 gold-glow-sm disabled:opacity-50 focus-gold touch-target"
          >
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {mutation.isPending ? "Saving..." : "Save Configuration"}
          </button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
