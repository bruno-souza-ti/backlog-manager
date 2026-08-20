import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

interface CommentRow {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

function mapCommentRow(row: CommentRow): TaskComment {
  return { id: row.id, taskId: row.task_id, authorId: row.author_id, content: row.content, createdAt: row.created_at };
}

/** Lazy-loaded per task (only fetches once a task is opened for editing), with realtime so a comment added by a teammate shows up live. Author names are resolved by the caller against the already-loaded team profiles list — no join needed here. */
export function useTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);

    supabase
      .from("task_comments")
      .select("id, task_id, author_id, content, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (!active) return;
        if (fetchError) {
          console.error("Erro ao carregar comentários:", fetchError);
          setError("Não foi possível carregar os comentários.");
        } else {
          setComments(((data as CommentRow[]) || []).map(mapCommentRow));
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id));
            return;
          }
          const mapped = mapCommentRow(payload.new as CommentRow);
          setComments((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [...prev, mapped]));
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [taskId]);

  const addComment = useCallback(
    async (content: string, authorId: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed || !taskId) return false;
      const { data, error: insertError } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, author_id: authorId, content: trimmed })
        .select()
        .single();
      if (insertError) {
        console.error("Erro ao adicionar comentário:", insertError);
        return false;
      }
      if (data) {
        const mapped = mapCommentRow(data as CommentRow);
        setComments((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [...prev, mapped]));
      }
      return true;
    },
    [taskId]
  );

  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    const { error: deleteError } = await supabase.from("task_comments").delete().eq("id", commentId);
    if (deleteError) {
      console.error("Erro ao excluir comentário:", deleteError);
      setComments(previous);
      return false;
    }
    return true;
  }, [comments]);

  return { comments, loading, error, addComment, deleteComment };
}
