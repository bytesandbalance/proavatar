interface CountdownTimerProps {
  timeRemaining: number;
  formattedTime: string;
}

export const CountdownTimer = ({ timeRemaining, formattedTime }: CountdownTimerProps) => {
  const isWarning = timeRemaining < 60000; // Less than 1 minute
  const isCritical = timeRemaining < 30000; // Less than 30 seconds

  return (
    <div className="flex items-center gap-2">
      <div className={`
        px-4 py-2 rounded-lg font-mono text-2xl font-bold
        transition-all duration-300
        ${isCritical 
          ? 'bg-destructive/20 text-destructive animate-pulse' 
          : isWarning 
          ? 'bg-amber-500/20 text-amber-500' 
          : 'bg-primary/20 text-primary'
        }
      `}>
        {formattedTime}
      </div>
      <span className="text-sm text-muted-foreground">remaining</span>
    </div>
  );
};
