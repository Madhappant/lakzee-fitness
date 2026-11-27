import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Clock, XCircle } from "lucide-react";

export interface ExpiringMember {
  id: string;
  name: string;
  memberId: string;
  planName: string;
  date: string;
  phone?: string;
}

export function ExpiringMembersModal({
  isOpen,
  onClose,
  members,
  type,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: ExpiringMember[];
  type: "EXPIRING" | "EXPIRED";
}) {
  const isExpiring = type === "EXPIRING";
  const Icon = isExpiring ? Clock : XCircle;
  const title = isExpiring ? "Expiring in 7 Days" : "Expired Members";
  const emptyText = isExpiring ? "No members are expiring soon." : "No expired members found.";
  const dateLabel = isExpiring ? "Expires" : "Expired";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-2xl translate-x-[-50%] translate-y-[-50%] p-6 rounded-2xl obsidian-glass shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2.5">
                <Icon
                  className={`w-5 h-5 ${isExpiring ? "text-[#D4FF00]" : "text-muted-foreground"}`}
                  aria-hidden="true"
                />
                {title}
              </h2>
              <button
                onClick={onClose}
                className="touch-target text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors focus-volt"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 -mx-6 px-6">
              {!members || members.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Icon className="w-10 h-10 mx-auto mb-3 opacity-25" aria-hidden="true" />
                  <p className="text-sm">{emptyText}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-border bg-secondary/40 hover:border-foreground/15 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{member.name}</p>
                        <p className="font-mono-metric text-xs text-[#D4FF00] mt-0.5">{member.memberId}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Plan: <span className="font-mono-metric text-foreground/85">{member.planName}</span>
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2 shrink-0">
                        <span
                          className={`font-mono-metric font-semibold px-3 py-1 rounded-full text-xs border ${
                            isExpiring
                              ? "text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/25"
                              : "text-muted-foreground bg-secondary border-border"
                          }`}
                        >
                          {dateLabel}: {new Date(member.date).toLocaleDateString()}
                        </span>
                        {member.phone && (
                          <a
                            href={`tel:${member.phone}`}
                            className="inline-flex items-center gap-1 font-mono-metric text-xs text-muted-foreground hover:text-foreground transition-colors focus-volt rounded"
                          >
                            <Phone className="w-3 h-3" aria-hidden="true" /> {member.phone}
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
