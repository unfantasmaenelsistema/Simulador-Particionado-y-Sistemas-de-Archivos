import React, { useEffect, useRef, useState } from 'react';
import { Play, Terminal, Trash2 } from 'lucide-react';
import { Disk, Partition, TerminalEntry } from '../types/storage';

interface ConsoleTerminalProps {
  entries: TerminalEntry[];
  activeDisk: Disk;
  selectedPartition: Partition | null;
  onExecuteCommand: (cmd: string) => void;
  onClearHistory: () => void;
}

const QUICK_COMMANDS = [
  { label: 'list disk / fdisk -l', cmd: 'list disk' },
  { label: 'list partition / lsblk', cmd: 'list partition' },
  { label: 'detail disk', cmd: 'detail disk' },
  { label: 'detail partition', cmd: 'detail partition' },
  { label: 'filesystems', cmd: 'filesystems' },
  { label: 'clean', cmd: 'clean' },
  { label: 'convert gpt', cmd: 'convert gpt' },
  { label: 'convert mbr', cmd: 'convert mbr' },
  { label: 'create efi 300MB', cmd: 'create partition efi size=300' },
  { label: 'create msr 16MB', cmd: 'create partition msr size=16' },
  { label: 'create primary 100GB', cmd: 'create partition primary size=102400' },
  { label: 'shrink 20GB', cmd: 'shrink desired=20480' },
  { label: 'extend 20GB', cmd: 'extend size=20480' },
  { label: 'format NTFS (4KB)', cmd: 'format fs=ntfs unit=4096 label="Sistema" quick' },
  { label: 'format FAT32', cmd: 'format fs=fat32 label="EFI-USB" quick' },
  { label: 'format exFAT (64KB)', cmd: 'format fs=exfat unit=65536 label="FlashPro" quick' },
  { label: 'format ext4 (4KB)', cmd: 'format fs=ext4 unit=4096 label="LinuxRoot" quick' },
  { label: 'format Linux Swap', cmd: 'format fs=swap label="LinuxSwap" quick' },
  { label: 'active', cmd: 'active' },
  { label: 'help', cmd: 'help' },
];

export const ConsoleTerminal: React.FC<ConsoleTerminalProps> = ({
  entries,
  activeDisk,
  selectedPartition,
  onExecuteCommand,
  onClearHistory,
}) => {
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [entries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setCmdHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    onExecuteCommand(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0 && historyIndex < cmdHistory.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInput(cmdHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInput(cmdHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-xs font-mono font-bold text-slate-200">
            DISKPART.EXE / PARTED CLI — Consola Dual Sincronizada (Windows + Linux)
          </span>
          <span className="text-xs font-mono text-slate-400">
            · Contexto: [{activeDisk.name} · {activeDisk.linuxDev} ({activeDisk.partitionTable})]
            {selectedPartition
              ? ` / [Partición ${selectedPartition.number}: ${selectedPartition.fileSystem}]`
              : ' / [Sin partición seleccionada]'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="px-2.5 py-1 rounded border border-slate-700 hover:border-slate-600 text-xs font-mono text-slate-300 hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-3 h-3" />
          Limpiar Consola (CLS)
        </button>
      </div>

      {/* Quick Command Reference Strip */}
      <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[11px] font-mono text-slate-400 shrink-0 mr-1">
          Comandos rápidos:
        </span>
        {QUICK_COMMANDS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onExecuteCommand(item.cmd)}
            className="px-2 py-1 rounded bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-500/40 text-[11px] font-mono text-slate-300 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0"
            title={`Ejecutar: ${item.cmd}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Console Output Viewport */}
      <div
        ref={scrollContainerRef}
        className="p-4 h-64 overflow-y-auto font-mono text-xs space-y-3 bg-slate-950"
      >
        <div className="text-slate-400 leading-relaxed">
          Microsoft DiskPart v10.0.26100.1 + Equivalencia GNU/Linux (parted / fdisk / mkfs)
          <br />
          Escribe <span className="text-sky-300 font-semibold">HELP</span> o <span className="text-sky-300 font-semibold">FILESYSTEMS</span> para ver todos los comandos o usa la interfaz gráfica superior.
        </div>

        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {entry.command && (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span className="text-sky-400 font-bold select-none">
                  DISKPART&gt;
                </span>
                <span className="font-semibold">{entry.command}</span>
                {entry.linuxEquivalent && (
                  <span className="text-[11px] text-amber-300/90 font-normal">
                    [Linux: # {entry.linuxEquivalent}]
                  </span>
                )}
                {entry.source === 'gui' && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    · Sincronizado desde GUI
                  </span>
                )}
              </div>
            )}
            {entry.output && (
              <pre
                className={`whitespace-pre-wrap pl-4 font-mono leading-relaxed ${
                  entry.status === 'error'
                    ? 'text-rose-300'
                    : entry.status === 'warning'
                      ? 'text-amber-300'
                      : entry.status === 'success'
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                }`}
              >
                {entry.output}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Command Prompt Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-t border-slate-800"
      >
        <span className="text-xs font-mono font-bold text-sky-400 shrink-0 select-none">
          DISKPART&gt;
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Escribe un comando (ej. "list disk", "shrink desired=20480", "format fs=exfat unit=65536 quick", "detail partition")...'
          aria-label="Comando de consola DiskPart"
          className="flex-1 bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          Ejecutar
        </button>
      </form>
    </div>
  );
};
