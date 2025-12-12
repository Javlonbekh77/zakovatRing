'use client';

import { CheckCircle2, Lock } from 'lucide-react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RoundNavigatorProps {
  totalRounds: number;
  activeRoundIndex: number;
  completedRounds: number[];
  onSelectRound: (index: number) => void;
  playerCurrentRoundIndex: number;
}

export default function RoundNavigator({
  totalRounds,
  activeRoundIndex,
  completedRounds,
  onSelectRound,
  playerCurrentRoundIndex
}: RoundNavigatorProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: totalRounds }).map((_, index) => {
          const isCompleted = completedRounds.includes(index);
          const isActive = index === activeRoundIndex;
          const isLocked = index > playerCurrentRoundIndex;

          let tooltipMessage = `Round ${index + 1}`;
          if (isCompleted) {
              tooltipMessage += ' (Completed)';
          } else if (isLocked) {
              tooltipMessage += ' (Locked)';
          } else {
              tooltipMessage += ' (In Progress)';
          }


          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'outline'}
                  size="icon"
                  className={`h-8 w-8 transition-all duration-200 ${
                    isCompleted && !isActive ? 'bg-green-100 dark:bg-green-900 border-green-500' : ''
                  }`}
                  onClick={() => onSelectRound(index)}
                  disabled={isLocked}
                >
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <span className="font-bold">{index + 1}</span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltipMessage}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
