import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense, updateExpense } from "@/lib/api/expenses";

const categories = [
  "SALARY", "MAINTENANCE", "RENT", "WATER", "ELECTRICITY", "CLEANING", "OTHER"
];
const paymentMethods = ["CASH", "UPI", "BANK_TRANSFER", "CREDIT_CARD"];

export interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: ExpenseItem | null;
}

export function ExpenseModal({ isOpen, onClose, expense = null }: ExpenseModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <ExpenseModalContent
          key={expense ? expense.id : "new"}
          onClose={onClose}
          expense={expense}
        />
      )}
    </AnimatePresence>
  );
}

function ExpenseModalContent({
  onClose,
  expense,
}: {
  onClose: () => void;
  expense: ExpenseItem | null;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: expense?.title || "",
    category: expense?.category || "OTHER",
    amount: expense ? expense.amount.toString() : "",
    date: expense
      ? new Date(expense.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    paymentMethod: expense?.paymentMethod || "CASH",
    notes: expense?.notes || "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: {
      title: string;
      category: string;
      amount: number;
      date: string;
      notes?: string;
    }) =>
      expense ? updateExpense(expense.id, data) : createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate({
      ...formData,
      amount: Number(formData.amount),
      date: new Date(formData.date).toISOString(),
    });
  };

  return (
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-modal-title"
            className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-1.5rem)] sm:w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-5 sm:p-6 rounded-3xl apple-glass-elevated shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 id="expense-modal-title" className="text-xl font-bold">{expense ? "Edit Expense" : "Add Expense"}</h2>
              <button 
                onClick={onClose} 
                aria-label="Close dialog"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-muted rounded-full transition-colors focus-gold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-6 p-4 bg-foreground/[0.08] border border-foreground/25 rounded-xl text-foreground text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title / Description</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus-gold transition-all outline-none"
                  placeholder="e.g., May Rent, Cleaning Supplies"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus-gold transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus-gold transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus-gold transition-all outline-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus-gold transition-all outline-none"
                  >
                    {paymentMethods.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus-gold transition-all outline-none resize-none"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full min-h-[48px] flex justify-center items-center gap-2 bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] font-bold py-3 px-4 rounded-xl active:scale-[0.98] transition-all duration-200 gold-glow-sm disabled:opacity-50 mt-4 focus-gold touch-target"
              >
                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {expense ? "Update Expense" : "Save Expense"}
              </button>
            </form>
          </motion.div>
    </>
  );
}
