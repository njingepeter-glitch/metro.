import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  name: string;
  isComplete: boolean;
}

interface CreateFormStepperProps {
  steps: Step[];
  currentStep: number;
}

export const CreateFormStepper = ({ steps, currentStep }: CreateFormStepperProps) => {
  return (
    <div className="space-y-3 mb-6">
      {/* Step pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isCurrent = stepNum === currentStep;
          const isPast = stepNum < currentStep;

          return (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0",
                isCurrent && "bg-[#008080] text-white shadow-md",
                !isCurrent && step.isComplete && "bg-green-50 text-green-700 border border-green-200",
                !isCurrent && !step.isComplete && isPast && "bg-red-50 text-red-600 border border-red-200",
                !isCurrent && !step.isComplete && !isPast && "bg-slate-50 text-slate-400 border border-slate-100"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-black shrink-0",
                  isCurrent && "bg-white/20",
                  !isCurrent && step.isComplete && "bg-green-500 text-white",
                  !isCurrent && !step.isComplete && isPast && "bg-red-500 text-white",
                  !isCurrent && !step.isComplete && !isPast && "bg-slate-200 text-slate-500"
                )}
              >
                {step.isComplete && !isCurrent ? <Check className="h-3 w-3" /> : stepNum}
              </span>
              <span className="hidden sm:inline">{step.name}</span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div
          className="h-full bg-[#008080] rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
};