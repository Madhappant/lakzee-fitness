"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStaff, assignRole, revokeRole } from "@/lib/api/staff";
import { ShieldCheck, Loader2, UserMinus } from "lucide-react";

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ userId: "", role: "receptionist" });

  const { data, isLoading } = useQuery({ queryKey: ["staff"], queryFn: fetchStaff });
  const staff = data?.data || [];

  const assignMutation = useMutation({
    mutationFn: () => assignRole(formData.userId, formData.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setFormData({ userId: "", role: "receptionist" });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: revokeRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) return;
    assignMutation.mutate();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">Staff & Roles</h1>
        <p className="text-muted-foreground">Assign roles to users. Ask each staff member to sign up first, then paste their UUID from their Profile page.</p>
      </div>

      {/* Assignment Form */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 border border-border space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">User UUID</label>
          <input 
            required
            value={formData.userId}
            onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
            placeholder="e.g. 8b8d..." 
            className="w-full bg-card/50 border border-border rounded-lg px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none font-mono"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Role</label>
          <select 
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            className="w-full bg-card/50 border border-border rounded-lg px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
          >
            <option value="receptionist">receptionist</option>
            <option value="trainer">trainer</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <button 
          type="submit" 
          disabled={assignMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-primary-foreground bg-brand-gold hover:bg-yellow-500 font-semibold transition-colors disabled:opacity-50"
        >
          {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Assign
        </button>
      </form>

      {/* Staff Table */}
      <div className="glass-panel overflow-hidden border border-border">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Assigned</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand-gold mx-auto" /></td>
                </tr>
              )}
              {staff.map((user: any) => (
                <tr key={user.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-6 py-4 font-mono text-muted-foreground">{user.id}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-brand-gold/20 text-brand-gold border border-brand-gold/30 lowercase">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => revokeMutation.mutate(user.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <UserMinus className="w-4 h-4" /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
