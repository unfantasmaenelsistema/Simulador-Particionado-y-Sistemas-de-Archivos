import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Circle,
  HelpCircle,
  Play,
} from 'lucide-react';
import { Disk, FirmwareType } from '../types/storage';
import {
  CHALLENGE_SCENARIOS,
  evaluateChallenge,
} from '../utils/diskEngine';

interface ChallengesPanelProps {
  disks: Disk[];
  firmware: FirmwareType;
  activeChallengeId: string;
  onSelectChallenge: (challengeId: string) => void;
  onLoadChallengeWorkspace: (
    challengeId: string,
    targetDiskId: number,
    recommendedFirmware: FirmwareType
  ) => void;
}

export const ChallengesPanel: React.FC<ChallengesPanelProps> = ({
  disks,
  firmware,
  activeChallengeId,
  onSelectChallenge,
  onLoadChallengeWorkspace,
}) => {
  const [showHintId, setShowHintId] = useState<string | null>(null);

  const completedCount = CHALLENGE_SCENARIOS.filter((scenario) => {
    const reqs = evaluateChallenge(scenario.id, disks, firmware);
    return reqs.length > 0 && reqs.every((r) => r.passed);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header Progress */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-sky-400" />
            Retos Prácticos de Administración de Discos y Sistemas de Archivos
          </h2>
          <p className="text-xs text-slate-400">
            Cada supuesto práctico se evalúa en tiempo real conforme modificas las particiones desde la interfaz gráfica o mediante comandos de consola DiskPart / Parted.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono tabular-nums text-xs shrink-0 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400">Progreso de Laboratorio:</span>
          <span className="text-sm font-bold text-emerald-300">
            {completedCount} / {CHALLENGE_SCENARIOS.length} Retos Superados
          </span>
        </div>
      </div>

      {/* Challenge Cards */}
      <div className="grid grid-cols-1 gap-4">
        {CHALLENGE_SCENARIOS.map((scenario) => {
          const requirements = evaluateChallenge(scenario.id, disks, firmware);
          const allPassed =
            requirements.length > 0 && requirements.every((r) => r.passed);
          const isFocused = activeChallengeId === scenario.id;
          const isHintOpen = showHintId === scenario.id;

          return (
            <div
              key={scenario.id}
              onClick={() => onSelectChallenge(scenario.id)}
              className={`rounded-xl border p-5 transition-all cursor-pointer ${
                allPassed
                  ? 'bg-emerald-950/15 border-emerald-700/60'
                  : isFocused
                    ? 'bg-slate-900/90 border-sky-500/60'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="text-sky-400 font-bold">
                      RETO {scenario.number}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Nivel {scenario.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span>Disco Objetivo: Disco {scenario.targetDiskId}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        allPassed
                          ? 'text-emerald-300 font-bold'
                          : 'text-amber-300 font-semibold'
                      }
                    >
                      {allPassed ? 'ESTADO: SUPERADO' : 'ESTADO: EN CURSO'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {scenario.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {scenario.description}
                  </p>
                  <p className="text-xs text-sky-300/90">
                    Objetivo didáctico: {scenario.learningGoal}
                  </p>
                </div>

                <div
                  className="flex flex-wrap items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowHintId(isHintOpen ? null : scenario.id)
                    }
                    className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-950 text-xs font-medium text-slate-300 hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                    {isHintOpen ? 'Ocultar Pista CLI' : 'Ver Pista Windows/Linux'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onLoadChallengeWorkspace(
                        scenario.id,
                        scenario.targetDiskId,
                        scenario.recommendedFirmware
                      )
                    }
                    className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Ir al Disco {scenario.targetDiskId} en Simulador
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Live Requirements Checklist */}
              <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {requirements.map((req) => (
                  <div
                    key={req.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs ${
                      req.passed
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    {req.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="flex-1">{req.label}</span>
                    <span
                      className={`font-mono text-[10px] font-bold shrink-0 ${
                        req.passed ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {req.passed ? 'COMPLETADO' : 'PENDIENTE'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Optional Hint Sequence */}
              {isHintOpen && (
                <div
                  className="mt-3 p-3.5 rounded-lg bg-slate-950 border border-sky-500/30 text-xs font-mono space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      Secuencia Windows DiskPart:
                    </div>
                    <code className="text-sky-200">{scenario.hintCommand}</code>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      Equivalencia GNU/Linux (parted / mkfs):
                    </div>
                    <code className="text-amber-200">
                      {scenario.linuxHintCommand}
                    </code>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
