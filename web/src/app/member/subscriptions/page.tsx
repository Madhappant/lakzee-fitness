"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMySubscriptions } from "@/lib/api/portal";
import { Loader2, Receipt, CreditCard, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function MemberSubscriptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["mySubscriptions"],
    queryFn: fetchMySubscriptions,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  const subscriptions = data?.data || [];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Subscriptions</h1>
        <p className="text-muted-foreground">View your payment history and past membership plans.</p>
      </div>

      <div className="glass-panel p-6 border border-border">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-gold" />
            Payment History
          </h2>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No subscription records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-4 pr-4">Plan Details</th>
                  <th className="pb-4 px-4">Validity Period</th>
                  <th className="pb-4 px-4">Amount</th>
                  <th className="pb-4 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {subscriptions.map((sub: any, i: number) => {
                  const isActive = sub.status === 'ACTIVE';
                  
                  return (
                    <motion.tr 
                      key={sub.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <p className="font-bold text-foreground">{sub.plan?.name}</p>
                        <p className="text-xs text-brand-gold mt-1">Purchased on {new Date(sub.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-white/20" />
                          <span>
                            {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-lg">₹{sub.plan?.price}</p>
                        <span className="text-xs text-green-400">Paid</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isActive 
                            ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20' 
                            : 'bg-white/5 text-muted-foreground border-border'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
