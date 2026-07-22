"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMembers, deleteMember, API_URL } from "@/lib/api/members";
const BASE_URL = API_URL.replace('/api', '');
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Loader2, Trash2, Edit2, FileText, X } from "lucide-react";
import Image from "next/image";

export default function MembersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const members = data?.data || [];

  const filteredMembers = members.filter((member: any) => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchLower);
    const emailMatch = member.email.toLowerCase().includes(searchLower);
    const idMatch = member.memberProfile?.memberId?.toLowerCase().includes(searchLower) || false;
    return nameMatch || emailMatch || idMatch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Members Management</h1>
          <p className="text-muted-foreground text-sm md:text-base">View and manage all registered gym members.</p>
        </div>
        <Link 
          href="/admin/members/new"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-black bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all shadow-lg shadow-brand-gold/20 w-full md:w-auto"
        >
          <Plus className="w-5 h-5" /> Add New Member
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by name, email, or ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:border-brand-gold/50 outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select className="bg-card/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-brand-gold/50 outline-none w-full md:w-auto appearance-none">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Lakzee ID</th>
                <th className="px-6 py-4 font-medium">Member Name</th>
                <th className="px-6 py-4 font-medium">Email & Phone</th>
                <th className="px-6 py-4 font-medium">Gender</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b border-border/50">
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-muted/60 animate-pulse rounded"></div></td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted/60 animate-pulse rounded-full shrink-0"></div>
                        <div className="h-4 w-32 bg-muted/60 animate-pulse rounded"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-40 bg-muted/60 animate-pulse rounded mb-2"></div>
                        <div className="h-3 w-24 bg-muted/60 animate-pulse rounded"></div>
                      </td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-muted/60 animate-pulse rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-16 bg-muted/60 animate-pulse rounded-full"></div></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <div className="h-8 w-8 bg-muted/60 animate-pulse rounded-lg"></div>
                          <div className="h-8 w-8 bg-muted/60 animate-pulse rounded-lg"></div>
                          <div className="h-8 w-8 bg-muted/60 animate-pulse rounded-lg"></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {!isLoading && filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No members found.
                  </td>
                </tr>
              )}

              {filteredMembers.map((member: any, i: number) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={member.id} 
                  className="hover:bg-muted/50 transition-colors group"
                >
                  <td className="px-6 py-4 font-medium text-brand-gold">
                    {member.memberProfile?.memberId || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setSelectedMember(member)}
                      className="flex items-center gap-3 hover:text-brand-gold transition-colors text-left"
                    >
                      {member.memberProfile?.photoUrl ? (
                        <Image 
                          src={`${BASE_URL}${member.memberProfile.photoUrl}`} 
                          alt="Profile" 
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover border border-brand-gold/20"
                          unoptimized
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-xs shrink-0">
                          {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                        </div>
                      )}
                      <span className="font-semibold">{member.firstName} {member.lastName}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-foreground">{member.email}</p>
                    <p className="text-muted-foreground text-xs mt-1">{member.phone || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">
                    {member.memberProfile?.gender?.toLowerCase() || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link 
                        href={`/admin/members/${member.id}/plan`}
                        className="p-2 text-muted-foreground hover:text-green-400 transition-colors rounded-lg hover:bg-green-400/10"
                        title="Assign Plan"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link 
                        href={`/admin/members/${member.id}/edit`}
                        className="p-2 text-muted-foreground hover:text-brand-gold transition-colors rounded-lg hover:bg-brand-gold/10"
                        title="Edit Member"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => handleDelete(member.id, member.firstName)}
                        className="p-2 text-muted-foreground hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                        title="Delete Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Details Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSelectedMember(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="p-6">
                <button 
                  onClick={() => setSelectedMember(null)}
                  className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center text-center mt-2">
                  {selectedMember.memberProfile?.photoUrl ? (
                    <Image 
                      src={`${BASE_URL}${selectedMember.memberProfile.photoUrl}`} 
                      alt="Profile" 
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-full object-cover border-4 border-brand-gold/20 shadow-xl mb-4"
                      unoptimized
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border-4 border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-3xl mb-4 shadow-xl">
                      {selectedMember.firstName.charAt(0)}{selectedMember.lastName.charAt(0)}
                    </div>
                  )}
                  
                  <h3 className="text-2xl font-bold text-foreground">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </h3>
                  <p className="text-brand-gold font-medium mt-1">
                    {selectedMember.memberProfile?.memberId || 'Pending ID'}
                  </p>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background p-3 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                      <p className="text-sm font-medium truncate" title={selectedMember.email}>{selectedMember.email}</p>
                    </div>
                    <div className="bg-background p-3 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-sm font-medium truncate">{selectedMember.phone || 'N/A'}</p>
                    </div>
                    <div className="bg-background p-3 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Gender</p>
                      <p className="text-sm font-medium capitalize">{selectedMember.memberProfile?.gender?.toLowerCase() || 'N/A'}</p>
                    </div>
                    <div className="bg-background p-3 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Blood Group</p>
                      <p className="text-sm font-medium">{selectedMember.memberProfile?.bloodGroup || 'N/A'}</p>
                    </div>
                    <div className="bg-background p-3 rounded-xl border border-border col-span-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined Date</p>
                      <p className="text-sm font-medium">
                        {selectedMember.memberProfile?.joiningDate 
                          ? new Date(selectedMember.memberProfile.joiningDate).toLocaleDateString() 
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <Link 
                    href={`/admin/members/${selectedMember.id}/edit`}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-3 rounded-xl transition-colors text-center"
                  >
                    Edit Profile
                  </Link>
                  <Link 
                    href={`/admin/members/${selectedMember.id}/plan`}
                    className="flex-1 bg-brand-gold hover:bg-brand-gold/90 text-black font-semibold py-3 rounded-xl transition-colors text-center"
                  >
                    Manage Plan
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
