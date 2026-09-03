import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense, updateExpense } from "@/lib/api/expenses";

const categories = [
  "SALARY", "MAINTENANCE", "RENT", "WATER", "ELECTRICITY", "CLEANING", "OTHER"
];
const paymentMethods = ["CASH", "UPI", "BANK_TRANSFER", "CREDIT_CARD"];

export function ExpenseModal({ isOpen, onClose, expense = null }: { isOpen: boolean; onClose: () => void; expense?: any }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    category: "OTHER",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "CASH",
    notes: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (expense) {
      setFormData({
        title: expense.title,
        category: expense.category,
        amount: expense.amount.toString(),
        date: new Date(expense.date).toISOString().split("T")[0],
        paymentMethod: expense.paymentMethod,
        notes: expense.notes || ""
      });
    } else {
      setFormData({
        title: "",
        category: "OTHER",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "CASH",
        notes: ""
      });
    }
  }, [expense, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: any) => expense ? updateExpense(expense.id, data) : createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
    onError: (err: any) => setError(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate({
      ...formData,
      amount: Number(formData.amount),
      date: new Date(formData.date).toISOString()
    });
  };

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
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-6 rounded-2xl bg-card border border-border shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{expense ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm">
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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
                  placeholder="e.g., May Rent, Cleaning Supplies"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
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
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none resize-none"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full flex justify-center items-center gap-2 bg-brand-gold text-primary-foreground font-bold py-3 px-4 rounded-xl hover:bg-yellow-500 transition-colors disabled:opacity-50 mt-4"
              >
                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {expense ? "Update Expense" : "Save Expense"}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
