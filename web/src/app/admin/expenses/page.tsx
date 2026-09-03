"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchExpenses, deleteExpense } from "@/lib/api/expenses";
import { ExpenseModal } from "@/components/expenses/ExpenseModal";
import { Plus, Receipt, IndianRupee, Trash2, Edit2, Loader2, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", selectedMonth, selectedYear],
    queryFn: () => fetchExpenses(selectedMonth, selectedYear),
  });

  const expenses = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      deleteMut.mutate(id);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const totalAmount = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Expenses</h1>
          <p className="text-muted-foreground">Manage and track your operational costs.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 bg-brand-gold text-primary-foreground font-bold px-6 py-3 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-brand-gold/20"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-gold/10 flex items-center justify-center shrink-0">
            <IndianRupee className="w-8 h-8 text-brand-gold" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Expenses (Selected Month)</p>
            <h3 className="text-3xl font-bold text-foreground">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-muted-foreground" />
            <div className="flex-1 flex gap-4">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
              >
                {Array.from({length: 12}).map((_, i) => (
                  <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-32 bg-background border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-gold outline-none"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-gold" />
            Expense Records
          </h2>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Payment Method</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading expenses...
                  </td>
                </tr>
              )}

              {!isLoading && expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No expenses recorded for this month</p>
                  </td>
                </tr>
              )}

              {!isLoading && expenses.map((exp: any) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={exp.id} 
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {new Date(exp.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {exp.title}
                    {exp.notes && <p className="text-xs text-muted-foreground font-normal mt-1">{exp.notes}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-brand-gold">
                    ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {exp.paymentMethod.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(exp)}
                        className="p-2 text-muted-foreground hover:text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(exp.id)}
                        disabled={deleteMut.isPending}
                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
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

      <ExpenseModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        expense={editingExpense} 
      />
    </div>
  );
}
