import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  userId: string | undefined,
  activityType: string,
  description: string,
  tableName?: string
) {
  if (!userId) return;
  await supabase.from("activity_logs").insert({
    user_id: userId,
    activity_type: activityType,
    description,
    table_name: tableName ?? null,
  } as never);
}
