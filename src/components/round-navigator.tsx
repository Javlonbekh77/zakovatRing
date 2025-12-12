'use client';

import { CheckCircle2 } from 'lucide-react';
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
}

export default function RoundNavigator({
  totalRounds,
  activeRoundIndex,
  completedRounds,
  onSelectRound,
}: RoundNavigatorProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: totalRounds }).map((_, index) => {
          const isCompleted = completedRounds.includes(index);
          const isActive = index === activeRoundIndex;

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
                  disabled={!isCompleted && index > completedRounds.length }
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <span className="font-bold">{index + 1}</span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Round {index + 1}
                  {isCompleted ? ' (Completed)' : ''}
                  {index > completedRounds.length ? ' (Locked)' : ''}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
