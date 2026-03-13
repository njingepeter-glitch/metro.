import { ArrowLeft, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DetailNavBarProps {
  scrolled: boolean;
  itemName: string;
  isSaved: boolean;
  onSave: () => void;
  onBack: () => void;
  onShare?: () => void;
}

export const DetailNavBar = ({
  scrolled,
  itemName,
  isSaved,
  onSave,
  onBack,
  onShare,
}: DetailNavBarProps) => {
  return (
    <>
      {/* ── Always-visible nav bar (mobile + desktop) ── */}
      <div
        className="fixed top-0 left-0 right-0 z-[100]"
      >
        {/* Mobile frosted glass pill - always visible, respects safe area */}
        <div className="md:hidden mx-3 mt-3" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div
            className="
              flex items-center justify-between
              px-3 py-2.5
              rounded-2xl
              bg-white/80 backdrop-blur-xl
              shadow-[0_8px_32px_rgba(0,0,0,0.12),0_1px_0_rgba(255,255,255,0.8)_inset]
              border border-white/60
            "
          >
            {/* Back */}
            <button
              onClick={onBack}
              className="
                flex items-center justify-center
                w-9 h-9 rounded-xl
                bg-slate-100/80 hover:bg-slate-200/80
                text-slate-700
                transition-all duration-150 active:scale-95
              "
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            </button>

            {/* Title */}
            <p
              className="
                flex-1 mx-3
                text-[11px] font-black uppercase tracking-[0.12em]
                text-slate-800 truncate text-center
              "
            >
              {itemName}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {onShare && (
                <button
                  onClick={onShare}
                  className="
                    flex items-center justify-center
                    w-9 h-9 rounded-xl
                    bg-slate-100/80 hover:bg-slate-200/80
                    text-slate-600
                    transition-all duration-150 active:scale-95
                  "
                >
                  <Share2 className="h-4 w-4 stroke-[2]" />
                </button>
              )}
              <button
                onClick={onSave}
                className={`
                  flex items-center justify-center
                  w-9 h-9 rounded-xl
                  transition-all duration-200 active:scale-95
                  ${isSaved
                    ? "bg-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.4)]"
                    : "bg-slate-100/80 hover:bg-slate-200/80"}
                `}
              >
                <Heart
                  className={`
                    h-4 w-4 stroke-[2.5]
                    transition-all duration-200
                    ${isSaved ? "fill-white text-white scale-110" : "text-slate-600"}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop sticky nav */}
        <div
          className={`
            hidden md:flex items-center justify-between
            px-6 py-3
            bg-white/80 backdrop-blur-xl
            border-b border-slate-200/60
            shadow-sm
            transition-all duration-300 ease-in-out
            ${scrolled
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none"}
          `}
        >
          <button
            onClick={onBack}
            className="
              flex items-center gap-2
              px-4 py-2 rounded-xl
              text-slate-700 text-xs font-black uppercase tracking-widest
              bg-slate-100 hover:bg-slate-200
              transition-all duration-150 active:scale-95
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <p className="text-sm font-black uppercase tracking-[0.1em] text-slate-800 truncate max-w-md">
            {itemName}
          </p>

          <button
            onClick={onSave}
            className={`
              flex items-center gap-2
              px-4 py-2 rounded-xl
              text-xs font-black uppercase tracking-widest
              transition-all duration-200 active:scale-95
              ${isSaved
                ? "bg-red-500 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"}
            `}
          >
            <Heart className={`h-4 w-4 ${isSaved ? "fill-white" : ""}`} />
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
};
