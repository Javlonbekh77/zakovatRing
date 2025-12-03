'use server';

// This file is no longer needed as all logic is handled on the client
// with direct Firestore communication. It can be deleted.
// Keeping it empty for now to avoid breaking imports if any exist.

import { redirect } from 'next/navigation';

export async function joinGameWithFirestore(gameId: string) {
  redirect(`/game/${gameId}`);
}
