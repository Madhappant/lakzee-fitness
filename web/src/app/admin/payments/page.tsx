"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSubscriptions, createSubscription, fetchPaymentStats, updateSubscription, deleteSubscription } from "@/lib/api/subscriptions";
import { fetchMembers } from "@/lib/api/members";
import { fetchPlans } from "@/lib/api/plans";
import { Plus, X, Loader2, Calendar as CalendarIcon, CheckCircle2, CalendarRange, Wallet, ListTree, Edit2, Trash2, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"ASSIGN" | "EDIT">("ASSIGN");
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    memberId: "",
    planId: "",
    startDate: new Date().toISOString().split('T')[0], // Today's date by default
    status: "ACTIVE",
    paymentStatus: "PAID",
  });

  // Fetching Data
  const { data: subsData, isLoading: loadingSubs } = useQuery({ queryKey: ["subscriptions"], queryFn: fetchSubscriptions });
  const { data: statsData } = useQuery({ queryKey: ["paymentStats"], queryFn: fetchPaymentStats });
  const { data: membersData } = useQuery({ queryKey: ["members"], queryFn: fetchMembers });
  const { data: plansData } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const subscriptions = subsData?.data || [];
  const stats = statsData?.data || { todaysCollection: 0, thisMonth: 0, totalRecords: 0 };
  const members = membersData?.data || [];
  const plans = plansData?.data || [];

  const mutation = useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentStats"] });
      setIsModalOpen(false);
      setFormData({ memberId: "", planId: "", startDate: new Date().toISOString().split('T')[0], status: "ACTIVE", paymentStatus: "PAID" });
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updateSubscription(selectedSubId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentStats"] });
      setIsModalOpen(false);
      setFormData({ memberId: "", planId: "", startDate: new Date().toISOString().split('T')[0], status: "ACTIVE", paymentStatus: "PAID" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentStats"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === "EDIT") {
      updateMut.mutate(formData);
    } else {
      mutation.mutate(formData);
    }
  };

  const handlePlanOrDateChange = (field: 'planId' | 'startDate', value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      const plan = plans.find((p: any) => p.id === newData.planId);
      
      if (plan) {
        const start = new Date(newData.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (end >= today && newData.status === 'EXPIRED') {
           newData.status = 'ACTIVE';
        } else if (end < today && newData.status === 'ACTIVE') {
           newData.status = 'EXPIRED';
        }
      }
      return newData;
    });
  };

  const handleEdit = (sub: any) => {
    setModalMode("EDIT");
    setSelectedSubId(sub.id);
    setFormData({
      memberId: sub.memberId,
      planId: sub.planId,
      startDate: new Date(sub.startDate).toISOString().split('T')[0],
      status: sub.status,
      paymentStatus: sub.paymentStatus || "PAID",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this subscription?")) {
      deleteMut.mutate(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border border-border relative overflow-hidden group hover:border-brand-gold/30 transition-colors">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">Today's Collection</h3>
            <Wallet className="w-5 h-5 text-green-500/50" />
          </div>
          <p className="text-3xl font-bold text-green-500">₹{stats.todaysCollection.toLocaleString()}</p>
        </div>
        
        <div className="glass-panel p-6 border border-border relative overflow-hidden group hover:border-brand-gold/30 transition-colors">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">This Month</h3>
            <CalendarRange className="w-5 h-5 text-brand-gold/50" />
          </div>
          <p className="text-3xl font-bold text-brand-gold">₹{stats.thisMonth.toLocaleString()}</p>
        </div>

        <div className="glass-panel p-6 border border-border relative overflow-hidden group hover:border-brand-gold/30 transition-colors">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">Total Records</h3>
            <ListTree className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.totalRecords.toLocaleString()}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Payments & Subscriptions</h1>
          <p className="text-muted-foreground">Manage member active subscriptions and billing.</p>
        </div>
        <button 
          onClick={() => {
            setModalMode("ASSIGN");
            setFormData({ memberId: "", planId: "", startDate: new Date().toISOString().split('T')[0], status: "ACTIVE", paymentStatus: "PAID" });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all shadow-lg shadow-brand-gold/20"
        >
          <Plus className="w-5 h-5" /> Assign Plan
        </button>
      </div>

      {/* Subscriptions Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Member</th>
                <th className="px-6 py-4 font-medium">Plan Name</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Start Date</th>
                <th className="px-6 py-4 font-medium">Expiry Date</th>
                <th className="px-6 py-4 font-medium">Payment</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingSubs && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-gold mx-auto mb-4" />
                  </td>
                </tr>
              )}

              {!loadingSubs && subscriptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No active subscriptions found.
                  </td>
                </tr>
              )}

              {subscriptions.map((sub: any, i: number) => {
                const isActive = sub.status === 'ACTIVE';
                
                return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={sub.id} 
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold text-xs border border-brand-gold/20">
                          {sub.member?.user?.firstName?.charAt(0)}{sub.member?.user?.lastName?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-foreground">{sub.member?.user?.firstName} {sub.member?.user?.lastName}</p>
                          <p className="text-brand-gold text-xs">{sub.member?.memberId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground">{sub.plan?.name}</td>
                    <td className="px-6 py-4 font-medium text-brand-gold">₹{sub.plan?.price}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {new Date(sub.startDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {new Date(sub.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sub.paymentStatus === 'PAID' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                        {sub.paymentStatus || 'PAID'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {isActive && <CheckCircle2 className="w-3 h-3" />}
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(sub)}
                          className="p-2 text-muted-foreground hover:text-brand-gold transition-colors rounded-lg hover:bg-brand-gold/10"
                          title="Edit Subscription"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 text-muted-foreground hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                          title="Delete Subscription"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Plan Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-panel p-6 sm:p-8 border border-border shadow-2xl shadow-brand-gold/10"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-brand-gold">
                {modalMode === "ASSIGN" ? "Assign Subscription" : "Edit Subscription"}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Select Member</label>
                  <select 
                    required 
                    disabled={modalMode === "EDIT"}
                    name="memberId" 
                    value={formData.memberId} 
                    onChange={e => setFormData(p => ({...p, memberId: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none disabled:opacity-50"
                  >
                    <option value="" disabled>-- Select a member --</option>
                    {members.map((m: any) => (
                      <option key={m.memberProfile.id} value={m.memberProfile.id}>
                        {m.memberProfile.memberId} - {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Select Plan</label>
                  <select 
                    required 
                    name="planId" 
                    value={formData.planId} 
                    onChange={e => handlePlanOrDateChange('planId', e.target.value)} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="" disabled>-- Select a plan --</option>
                    {plans.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price} for {p.durationDays} days)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <input 
                    required 
                    type="date" 
                    name="startDate" 
                    value={formData.startDate} 
                    onChange={e => handlePlanOrDateChange('startDate', e.target.value)} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">Expiry date will be calculated automatically based on the plan's duration.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Subscription Status</label>
                  <select 
                    required 
                    name="status" 
                    value={formData.status} 
                    onChange={e => setFormData(p => ({...p, status: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="FROZEN">FROZEN</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Payment Status</label>
                  <select 
                    required 
                    name="paymentStatus" 
                    value={formData.paymentStatus} 
                    onChange={e => setFormData(p => ({...p, paymentStatus: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-foreground hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={mutation.isPending || updateMut.isPending} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all disabled:opacity-50">
                    {(mutation.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : (modalMode === "ASSIGN" ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
                    {modalMode === "ASSIGN" ? "Assign Plan" : "Save Changes"}
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
