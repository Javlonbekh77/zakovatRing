'use server';

import { redirect } from 'next/navigation';

// This is now a server action that simply triggers a redirect.
// The actual game creation logic is moved to the client-side form
// to use localStorage.
export async function createGameOnClient(gameId: string) {
  redirect(`/admin/created/${gameId}`);
}
