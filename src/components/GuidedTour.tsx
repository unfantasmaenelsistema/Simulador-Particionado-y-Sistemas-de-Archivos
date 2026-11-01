import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';

export interface TourStep {
  id: string;
  targetSelector: string;
  stepNumber: number;
  title: string;
  description: string;
  didacticTip: string;
  actionLabel?: string;
  onAction?: () => void;
  isStepCompleted?: boolean;
}

interface GuidedTourProps {
  isOpen: boolean;
  steps: TourStep[];
  currentStepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onGoToStep: (idx: number) => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  steps,
  currentStepIndex,
  onNext,
  onPrev,
  onClose,
  onGoToStep,
}) => {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const updatePosition = () => {
      const el = document.querySelector(
        `[data-tour="${currentStep.targetSelector}"]`
      );
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setTargetRect(null);
      }
    };

    const el = document.querySelector(
      `[data-tour="${currentStep.targetSelector}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update immediately and after smooth scroll settles
    updatePosition();
    const timer1 = setTimeout(updatePosition, 250);
    const timer2 = setTimeout(updatePosition, 550);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, currentStepIndex, currentStep]);

  if (!isOpen || !currentStep) return null;

  const isLastStep = currentStepIndex === steps.length - 1;

  // Compute safe tooltip coordinates so it stays inside the viewport
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const tooltipW = Math.min(430, viewportW - 32);
    const tooltipEstimatedH = 290;

    // Prefer placing below target if space permits; otherwise place above or pin safely
    const spaceBelow = viewportH - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;

    let top = targetRect.top + targetRect.height + 14;
    if (spaceBelow < tooltipEstimatedH && spaceAbove > tooltipEstimatedH) {
      top = Math.max(16, targetRect.top - tooltipEstimatedH - 14);
    } else if (spaceBelow < tooltipEstimatedH && spaceAbove <= tooltipEstimatedH) {
      top = Math.max(16, Math.min(viewportH - tooltipEstimatedH - 16, 80));
    }

    let left = targetRect.left;
    if (left + tooltipW > viewportW - 16) {
      left = Math.max(16, viewportW - tooltipW - 16);
    }
    if (left < 16) {
      left = 16;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipW}px`,
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      role="dialog"
      aria-label="Tour Guiado del Simulador"
    >
      {/* Dimmed Backdrop with Spotlight Cutout via Box-Shadow */}
      {targetRect ? (
        <div
          className="fixed rounded-xl transition-all duration-200 pointer-events-none ring-2 ring-sky-400"
          style={{
            top: `${Math.max(4, targetRect.top - 6)}px`,
            left: `${Math.max(4, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/75 pointer-events-none" />
      )}

      {/* Floating Interactive Tooltip Card */}
      <div
        style={getTooltipStyle()}
        className="fixed z-50 pointer-events-auto rounded-xl border border-sky-500/60 bg-slate-900/95 backdrop-blur-md p-5 shadow-2xl text-slate-100 transition-all duration-200"
      >
        {/* Tooltip Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-sky-300">
              TOUR GUIADO · PASO {currentStepIndex + 1} DE {steps.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 inline-flex items-center gap-1 transition-colors"
            title="Cerrar Tour Guiado"
          >
            <span>Saltar</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tooltip Content */}
        <div className="py-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-white leading-snug">
              {currentStep.title}
            </h4>
            {currentStep.isStepCompleted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-300 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                LISTO
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-sky-200 leading-relaxed flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <span>{currentStep.didacticTip}</span>
          </div>

          {/* Interactive 1-Click Action Helper inside Tooltip */}
          {currentStep.actionLabel && currentStep.onAction && (
            <div className="pt-1">
              <button
                type="button"
                onClick={currentStep.onAction}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/50 text-xs font-semibold text-emerald-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-300" />
                {currentStep.actionLabel}
              </button>
            </div>
          )}
        </div>

        {/* Step Dots & Navigation Controls */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onGoToStep(idx)}
                aria-label={`Ir al paso ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'w-5 bg-sky-400'
                    : 'w-2 bg-slate-700 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next Buttons */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-950 text-xs font-medium text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
            )}

            <button
              type="button"
              onClick={isLastStep ? onClose : onNext}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <span>{isLastStep ? 'Finalizar Tour' : 'Siguiente Paso'}</span>
              {!isLastStep && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
