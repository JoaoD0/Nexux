import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  channel: string;
  table: string;
  schema?: string;
  filter?: string;
  event?: RealtimeEvent;
  enabled?: boolean;
  onPayload: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

/**
 * Hook reutilizável para escutar mudanças em tempo real via WebSocket.
 * 
 * Exemplo:
 * ```ts
 * useRealtimeSubscription({
 *   channel: "queue-updates",
 *   table: "queue",
 *   event: "*",
 *   onPayload: (payload) => console.log(payload),
 * });
 * ```
 * 
 * WebSocket URL: wss://galcbklbtdnbodgeptad.supabase.co/realtime/v1/websocket
 */
export function useRealtimeSubscription({
  channel,
  table,
  schema = "public",
  filter,
  event = "*",
  enabled = true,
  onPayload,
}: UseRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const channelConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    };
    if (filter) channelConfig.filter = filter;

    const sub = supabase
      .channel(channel)
      .on(
        "postgres_changes" as any,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onPayload(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [channel, table, schema, filter, event, enabled]);
}
