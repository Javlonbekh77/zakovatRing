'use server';

import { redirect } from 'next/navigation';

// This is now a server action that simply triggers a redirect.
// The actual game creation logic is now in the client-side form
// using Firestore.
export async function createGameOnClient(gameId: string) {
  redirect(`/admin/created/${gameId}`);
}
