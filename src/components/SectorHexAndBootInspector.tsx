import React, { useState } from 'react';
import {
  Binary,
  CheckCircle2,
  Cpu,
  MonitorPlay,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { BootDiagnostic, Disk, FirmwareType } from '../types/storage';
import { generateSectorHexInspection } from '../utils/diskEngine';

interface SectorHexAndBootInspectorProps {
  disk: Disk;
  firmware: FirmwareType;
  bootDiagnostic: BootDiagnostic;
}

export const SectorHexAndBootInspector: React.FC<
  SectorHexAndBootInspectorProps
> = ({ disk, firmware, bootDiagnostic }) => {
  const [bootStep, setBootStep] = useState<number>(3);
  const [isSimulatingBoot, setIsSimulatingBoot] = useState<boolean>(false);

  const hexInspection = generateSectorHexInspection(disk);
  const screen = bootDiagnostic.simulatedScreenOutput;

  const handleRunBootSimulation = () => {
    setIsSimulatingBoot(true);
    setBootStep(1);
    setTimeout(() => setBootStep(2), 450);
    setTimeout(() => {
      setBootStep(3);
      setIsSimulatingBoot(false);
    }, 950);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left 7 Cols: Live Low-Level Sector 0 / GPT LBA Hexadecimal Inspector */}
      <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between space-y-4">
        <div className="space-y-1 border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Binary className="w-4 h-4 text-sky-400" />
              {hexInspection.sectorTitle}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {disk.linuxDev} · Sector {disk.sectorSize}B
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {hexInspection.sectorSubtitle}
          </p>
        </div>

        <div className="space-y-2.5 flex-1">
          {hexInspection.blocks.map((block, idx) => {
            const colorClasses =
              block.highlightColor === 'emerald'
                ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                : block.highlightColor === 'amber'
                  ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
                  : block.highlightColor === 'indigo'
                    ? 'border-indigo-400/40 bg-indigo-950/20 text-indigo-200'
                    : block.highlightColor === 'rose'
                      ? 'border-rose-500/40 bg-rose-950/20 text-rose-200'
                      : 'border-sky-500/35 bg-slate-950/80 text-sky-200';

            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 transition-colors ${colorClasses}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="font-bold text-white">{block.title}</span>
                  <span className="text-slate-400 tabular-nums">
                    Offset: {block.offsetHex} ({block.lengthBytes} bytes)
                  </span>
                </div>
                <div className="mt-1.5 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs tracking-wider text-sky-300 overflow-x-auto">
                  {block.hexBytes}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-300 font-sans leading-relaxed">
                  {block.meaning}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 5 Cols: Interactive POST / Boot Sequence Screen Emulator */}
      <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MonitorPlay className="w-4 h-4 text-sky-400" />
              Emulador de Secuencia de Arranque (POST)
            </h3>
            <p className="text-xs text-slate-400">
              Comprueba qué ocurre al encender el equipo con {firmware} sobre {disk.name} ({disk.partitionTable}).
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunBootSimulation}
            disabled={isSimulatingBoot}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            {isSimulatingBoot ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Probar Arranque
          </button>
        </div>

        {/* Simulated Monitor Viewport */}
        <div className="rounded-xl border-2 border-slate-700 bg-black p-4 font-mono text-xs flex-1 flex flex-col justify-between min-h-[250px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                FIRMWARE: {firmware === 'UEFI' ? 'UEFI v2.80 (64-bit)' : 'BIOS Legacy INT 13h (16-bit)'}
              </span>
              <span>BOOT TARGET: {disk.linuxDev}</span>
            </div>

            <div className="text-xs font-bold text-white">
              {screen.screenTitle}
            </div>

            <div className="space-y-2 pt-1">
              {screen.lines.slice(0, bootStep).map((line, i) => {
                const isErrorLine =
                  line.includes('ERROR') ||
                  line.includes('FALLO') ||
                  line.includes('Invalid') ||
                  line.includes('Missing') ||
                  line.includes('Reboot');
                return (
                  <div
                    key={i}
                    className={`leading-relaxed ${
                      isErrorLine
                        ? 'text-rose-400 font-semibold'
                        : i === screen.lines.length - 1 && bootDiagnostic.canBoot
                          ? 'text-emerald-400 font-semibold'
                          : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 mr-2">[Paso {i + 1}]</span>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-[11px]">
            {bootDiagnostic.canBoot ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                ARRANQUE EXITOSO EN {firmware} + {disk.partitionTable}
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="w-4 h-4" />
                FALLO DE ARRANQUE — REVISA LA TABLA O PARTICIÓN ACTIVA/EFI
              </span>
            )}
            <span className="text-slate-500">
              {disk.partitionTable === 'MBR' ? 'Signature: 0x55AA' : 'Signature: EFI PART'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
