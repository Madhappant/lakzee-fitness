/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPlans, createPlan, updatePlan, deletePlan } from "@/lib/api/plans";
import { useBranchScope } from "@/lib/branch-context";
import { Plus, X, Check, Loader2, DollarSign, Edit2, Trash2, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { activeBranchId } = useBranchScope();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"ADD" | "EDIT">("ADD");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    durationDays: "30",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["plans", activeBranchId],
    queryFn: fetchPlans,
  });
  const plans = data?.data || [];

  const mutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast.success("Plan created successfully!");
      setIsModalOpen(false);
      setModalError("");
      setFormData({ name: "", description: "", price: "", durationDays: "30" });
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to create plan";
      setModalError(msg);
      toast.error(msg);
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updatePlan(selectedPlanId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast.success("Plan updated successfully!");
      setIsModalOpen(false);
      setModalError("");
      setFormData({ name: "", description: "", price: "", durationDays: "30" });
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to update plan";
      setModalError(msg);
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast.success("Plan archived successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete plan");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    const parsedPrice = parseFloat(formData.price);
    const parsedDays = parseInt(formData.durationDays, 10);
    if (isNaN(parsedPrice) || parsedPrice < 0 || isNaN(parsedDays) || parsedDays < 1) {
      setModalError("Please enter valid price (>= 0) and duration (>= 1 day).");
      return;
    }
    const dataToSubmit = {
      ...formData,
      price: parsedPrice,
      durationDays: parsedDays,
    };
    if (modalMode === "EDIT") {
      updateMut.mutate(dataToSubmit);
    } else {
      mutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (plan: any) => {
    setModalError("");
    setModalMode("EDIT");
    setSelectedPlanId(plan.id);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      durationDays: plan.durationDays.toString(),
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this plan?")) {
      deleteMut.mutate(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Membership Plans</h1>
          <p className="text-muted-foreground text-sm md:text-base">Configure subscription packages, duration terms, and pricing tiers.</p>
        </div>
        <button 
          onClick={() => {
            setModalError("");
            setModalMode("ADD");
            setFormData({ name: "", description: "", price: "", durationDays: "30" });
            setIsModalOpen(true);
          }}
          className="touch-target gap-2 px-6 rounded-xl text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] font-bold transition-all gold-glow-sm focus-gold"
          aria-label="Create new membership plan"
        >
          <Plus className="w-5 h-5" aria-hidden="true" /> Create New Plan
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan: any, i: number) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={plan.id}
              className="glass-panel p-8 relative overflow-hidden group hover:border-brand-gold/50 transition-colors"
            >
              <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                <button 
                  onClick={() => handleEdit(plan)} 
                  className="w-9 h-9 flex items-center justify-center bg-card/90 border border-border/80 shadow-sm hover:border-brand-gold/50 hover:bg-brand-gold/20 text-foreground/80 hover:text-brand-gold rounded-xl backdrop-blur-md transition-all cursor-pointer focus-gold" 
                  title="Edit Plan"
                  aria-label={`Edit ${plan.name} plan`}
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button 
                  onClick={() => handleDelete(plan.id)} 
                  className="w-9 h-9 flex items-center justify-center bg-card/90 border border-border/80 shadow-sm hover:border-foreground/40 hover:bg-foreground/10 text-foreground/80 hover:text-foreground rounded-xl backdrop-blur-md transition-all cursor-pointer focus-gold" 
                  title="Delete Plan"
                  aria-label={`Delete ${plan.name} plan`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-5 transition-opacity pointer-events-none">
                <DollarSign className="w-24 h-24 text-brand-gold transform rotate-12" />
              </div>
              
              <h3 className="text-2xl font-bold mb-2 text-foreground">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">{plan.description}</p>
              
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold text-brand-gold">₹{plan.price}</span>
                <span className="text-muted-foreground font-medium">/ {plan.durationDays} days</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-brand-gold" />
                  </div>
                  Full gym access
                </li>
              </ul>
              
              <div className="pt-4 border-t border-border">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${plan.isActive ? 'bg-[#DBA12C]/15 text-[#F2C14E] border border-[#DBA12C]/30' : 'bg-foreground/10 text-foreground/80 border border-foreground/25'}`}>
                  {plan.isActive ? "Active Plan" : "Archived"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Custom Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#0A0A0C]/75 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-[calc(100%-1.5rem)] sm:w-full max-w-lg apple-glass-elevated p-5 sm:p-8 rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-foreground/10 transition-colors focus-gold"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-brand-gold">
                {modalMode === "ADD" ? "Create Plan" : "Edit Plan"}
              </h2>

              {modalError && (
                <div role="alert" className="mb-4 p-3 rounded-xl bg-foreground/[0.08] border border-foreground/25 text-foreground text-sm">
                  {modalError}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Plan Name</label>
                  <input required name="name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none" placeholder="e.g. Premium Annual" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <textarea name="description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none resize-none" rows={2} placeholder="Brief description of perks..." />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Price (₹)</label>
                    <input required type="number" step="0.01" name="price" value={formData.price} onChange={e => setFormData(p => ({...p, price: e.target.value}))} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Duration (Days)</label>
                    <input required type="number" name="durationDays" value={formData.durationDays} onChange={e => setFormData(p => ({...p, durationDays: e.target.value}))} className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none" />
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-foreground hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={mutation.isPending || updateMut.isPending} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] font-bold transition-all gold-glow-sm disabled:opacity-50">
                    {(mutation.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : (modalMode === "ADD" ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
                    {modalMode === "ADD" ? "Save Plan" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
