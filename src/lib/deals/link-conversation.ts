import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Keep every deal for a contact linked to the contact's canonical
 * conversation. Migration 036 guarantees one conversation per
 * (account, contact), so the same conversation can safely be stamped
 * onto every deal for that contact — even across multiple pipelines.
 *
 * This is intentionally best-effort: a chat send / inbound webhook
 * must never fail just because a deal-link update failed.
 */
export async function linkDealsToConversation(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await db
    .from('deals')
    .update({ conversation_id: conversationId })
    .eq('account_id', accountId)
    .eq('contact_id', contactId);

  if (error) {
    console.error(
      '[deals] failed to link conversation to contact deals:',
      error.message,
    );
  }
}
