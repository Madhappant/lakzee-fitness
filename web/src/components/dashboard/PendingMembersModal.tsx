import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Receipt } from "lucide-react";

export function PendingMembersModal({ isOpen, onClose, pendingMembers }: { isOpen: boolean; onClose: () => void; pendingMembers: any[] }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] p-6 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-500" /> 
                Pending Payments
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 -mx-6 px-6">
              {(!pendingMembers || pendingMembers.length === 0) ? (
                <div className="text-center text-muted-foreground py-12">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No pending payments to collect!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingMembers.map((member: any) => (
                    <div key={member.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-border bg-background/50 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-bold text-foreground">{member.name}</p>
                        <p className="text-sm text-brand-gold">{member.memberId}</p>
                        <p className="text-xs text-muted-foreground mt-1">Plan: {member.planName}</p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2 shrink-0">
                        <span className="font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-sm">
                          ₹{member.balanceAmount.toLocaleString()}
                        </span>
                        {member.phone && (
                          <a href={`tel:${member.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-gold transition-colors">
                            <Phone className="w-3 h-3" /> {member.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
