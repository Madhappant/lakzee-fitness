"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/lib/api/settings";
import { Save, Loader2, Building, Settings2 } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    gymName: "",
    branch: "",
    workingHours: "",
    gstNumber: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
  });
  
  const [successMessage, setSuccessMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (data?.data) {
      setFormData({
        gymName: data.data.gymName || "",
        branch: data.data.branch || "",
        workingHours: data.data.workingHours || "",
        gstNumber: data.data.gstNumber || "",
        contactEmail: data.data.contactEmail || "",
        contactPhone: data.data.contactPhone || "",
        address: data.data.address || "",
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
              <input required name="gymName" value={formData.gymName} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Branch / Location Name</label>
              <input name="branch" value={formData.branch} onChange={handleChange} placeholder="e.g. Downtown Metro" className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">GST Identification Number</label>
              <input name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none font-mono uppercase" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Working Hours</label>
              <input name="workingHours" value={formData.workingHours} onChange={handleChange} placeholder="e.g. 5:00 AM - 11:00 PM" className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-4 text-brand-gold">Contact Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Official Email</label>
              <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Support Phone</label>
              <input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Complete Address</label>
              <textarea name="address" rows={3} value={formData.address} onChange={handleChange} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none transition-colors resize-none"></textarea>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          {successMessage && (
            <span className="text-green-400 font-medium text-sm mr-4">{successMessage}</span>
          )}
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all shadow-lg shadow-brand-gold/20 disabled:opacity-50"
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
