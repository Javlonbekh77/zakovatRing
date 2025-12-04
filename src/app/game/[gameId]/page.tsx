import GameClient from '@/components/game-client';
import { Suspense } from 'react';

export default function GamePage({
  params: { gameId },
}: {
  params: { gameId: string };
}) {
  
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
       <Suspense fallback={<div className="text-xl">Loading Game...</div>}>
         <GameClient gameId={gameId} />
       </Suspense>
    </div>
  );
}
