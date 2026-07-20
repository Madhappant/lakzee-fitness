"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAnnouncements, createAnnouncement, deleteAnnouncement } from "@/lib/api/announcements";
import { Megaphone, Loader2, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  message: z.string().min(1, "Message is required").max(1000)
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements
  });

  const announcements = data?.data || [];

  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Announcement posted successfully!");
      setIsCreating(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to post announcement");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Announcement deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete announcement");
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema)
  });

  const onSubmit = (values: AnnouncementFormValues) => {
    createMutation.mutate(values);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this announcement? It will be removed from all members' notifications.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Announcements</h1>
          <p className="text-muted-foreground">Post announcements that will appear in the notification panel for all members.</p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-primary-foreground bg-brand-gold hover:bg-yellow-500 font-semibold transition-colors"
        >
          {isCreating ? <Megaphone className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isCreating ? "Cancel" : "New Announcement"}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-panel p-6 border border-brand-gold/30 mb-8">
              <h2 className="text-xl font-bold mb-6">Post New Announcement</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    {...register("title")}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                    placeholder="e.g., Gym Closed Tomorrow for Maintenance"
                  />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    {...register("message")}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-all min-h-[120px]"
                    placeholder="Type your announcement here..."
                  />
                  {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      reset();
                    }}
                    className="px-6 py-2.5 rounded-xl font-medium border border-border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-brand-gold text-primary-foreground hover:bg-yellow-500 transition-colors disabled:opacity-50"
                  >
                    {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
                    Post Announcement
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold">Past Announcements</h2>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No announcements posted yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement: any) => (
                <div key={announcement.id} className="p-6 rounded-xl border border-border bg-muted/20 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-brand-gold">{announcement.title}</h3>
                    <button 
                      onClick={() => handleDelete(announcement.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{announcement.message}</p>
                  <div className="mt-4 text-xs text-muted-foreground font-medium flex gap-4">
                    <span>Posted {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}</span>
                    <span>By {announcement.author.firstName} {announcement.author.lastName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
