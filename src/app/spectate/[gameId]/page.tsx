'use client';

import GameClient from '@/components/game-client';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function SpectatePage() {
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;

  if (!gameId) {
      return <div>Loading...</div>
  }

  return (
    <div className="flex-1 flex flex-col items-start justify-start p-2 sm:p-4 md:p-6 bg-muted/40">
       <Suspense fallback={<div className="text-xl w-full text-center pt-20">Loading Game for Spectators...</div>}>
         {/* By not passing teamName, GameClient defaults to spectator/admin mode */}
         <GameClient gameId={gameId} />
       </Suspense>
    </div>
  );
}
