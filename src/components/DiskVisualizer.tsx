import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  BootDiagnostic,
  Disk,
  FileSystemType,
  FirmwareType,
  PartitionRole,
} from '../types/storage';
import {
  calculateDiskSpace,
  calculatePartitionUsage,
  formatBytes,
  formatCapacity,
} from '../utils/diskEngine';

interface DiskVisualizerProps {
  disk: Disk;
  firmware: FirmwareType;
  selectedPartitionId: string | null;
  bootDiagnostic: BootDiagnostic;
  onSelectPartition: (partitionId: string | null) => void;
  onOpenCreateModal: (defaultRole?: PartitionRole) => void;
  onDeletePartition: (partitionId: string) => void;
  onToggleActive: (partitionId: string) => void;
}

const FS_VISUAL_STYLE: Record<
  FileSystemType | 'EXTENDED' | 'MSR',
  {
    topBar: string;
    bg: string;
    border: string;
    textAccent: string;
  }
> = {
  NTFS: {
    topBar: 'bg-sky-500',
    bg: 'bg-sky-950/35 hover:bg-sky-950/55',
    border: 'border-sky-500/40',
    textAccent: 'text-sky-300',
  },
  FAT32: {
    topBar: 'bg-emerald-500',
    bg: 'bg-emerald-950/35 hover:bg-emerald-950/55',
    border: 'border-emerald-500/40',
    textAccent: 'text-emerald-300',
  },
  exFAT: {
    topBar: 'bg-teal-400',
    bg: 'bg-teal-950/35 hover:bg-teal-950/55',
    border: 'border-teal-400/40',
    textAccent: 'text-teal-300',
  },
  ext4: {
    topBar: 'bg-amber-500',
    bg: 'bg-amber-950/35 hover:bg-amber-950/55',
    border: 'border-amber-500/40',
    textAccent: 'text-amber-300',
  },
  swap: {
    topBar: 'bg-fuchsia-400',
    bg: 'bg-fuchsia-950/30 hover:bg-fuchsia-950/50',
    border: 'border-fuchsia-400/40',
    textAccent: 'text-fuchsia-300',
  },
  RAW: {
    topBar: 'bg-rose-500',
    bg: 'bg-rose-950/30 hover:bg-rose-950/50',
    border: 'border-rose-500/40',
    textAccent: 'text-rose-300',
  },
  MSR: {
    topBar: 'bg-slate-400',
    bg: 'bg-slate-900/80 hover:bg-slate-800/80',
    border: 'border-slate-600/60',
    textAccent: 'text-slate-300',
  },
  EXTENDED: {
    topBar: 'bg-indigo-400',
    bg: 'bg-indigo-950/25',
    border: 'border-indigo-400/50 border-dashed',
    textAccent: 'text-indigo-300',
  },
};

export const DiskVisualizer: React.FC<DiskVisualizerProps> = ({
  disk,
  firmware,
  selectedPartitionId,
  bootDiagnostic,
  onSelectPartition,
  onOpenCreateModal,
  onDeletePartition,
  onToggleActive,
}) => {
  const space = calculateDiskSpace(disk);
  const topLevelPartitions = disk.partitions.filter((p) => p.role !== 'logical');
  const logicalPartitions = disk.partitions.filter((p) => p.role === 'logical');

  const getVisualFlexGrow = (sizeMB: number) => {
    const ratio = sizeMB / disk.totalSizeMB;
    return Math.max(12, Math.round(ratio * 100));
  };

  const getLinuxDevName = (partNumber: number) =>
    disk.linuxDev.includes('nvme')
      ? `${disk.linuxDev}p${partNumber}`
      : `${disk.linuxDev}${partNumber}`;

  return (
    <div className="space-y-5">
      {/* Firmware + Partition Table Live Diagnostic Banner */}
      <div
        className={`rounded-xl border p-4 transition-colors ${
          bootDiagnostic.status === 'nominal'
            ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-100'
            : bootDiagnostic.status === 'warning'
              ? 'bg-amber-950/20 border-amber-800/60 text-amber-100'
              : 'bg-rose-950/25 border-rose-800/60 text-rose-100'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {bootDiagnostic.status === 'nominal' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : bootDiagnostic.status === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                <span className="font-semibold text-slate-200">
                  DIAGNÓSTICO DE ARRANQUE ({firmware} + {disk.partitionTable})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {bootDiagnostic.canBoot ? 'ESTADO: APTO PARA ARRANQUE' : 'ESTADO: NO ARRANCABLE'}
                </span>
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-white">
                {bootDiagnostic.headline}
              </h3>
              <ul className="text-xs text-slate-300 space-y-0.5">
                {bootDiagnostic.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
              {bootDiagnostic.recommendation && (
                <p className="text-xs font-medium text-sky-300 pt-1">
                  Acción recomendada: {bootDiagnostic.recommendation}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-800">
            <div>
              <div className="text-slate-400">Capacidad Física</div>
              <div className="text-sm font-semibold text-white">
                {formatCapacity(disk.totalSizeMB).split(' (')[0]}
              </div>
            </div>
            <span className="text-slate-700">/</span>
            <div>
              <div className="text-slate-400">Libre Direccionable</div>
              <div className="text-sm font-semibold text-emerald-300">
                {formatCapacity(space.unallocatedAddressableMB).split(' (')[0]}
              </div>
            </div>
            {space.mbrLockedOver2TBMB > 0 && (
              <>
                <span className="text-slate-700">/</span>
                <div>
                  <div className="text-rose-400">Bloqueado &gt;2 TB (MBR)</div>
                  <div className="text-sm font-semibold text-rose-300">
                    {formatCapacity(space.mbrLockedOver2TBMB).split(' (')[0]}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GParted / Disk Management Graphical Block Map */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {disk.name} ({disk.linuxDev}): {disk.model}
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  · {disk.interfaceType} · Sector {disk.sectorSize}B
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Haz clic en cualquier bloque del mapa o fila inferior para inspeccionar su geometría, redimensionar, formatear o gestionar clústeres.
              </p>
            </div>
          </div>

          {/* Color & Pattern Legend */}
          <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-sky-500 inline-block" />
              <span>NTFS</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-emerald-500 inline-block" />
              <span>FAT32 / EFI</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-teal-400 inline-block" />
              <span>exFAT</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-amber-500 inline-block" />
              <span>ext4</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-fuchsia-400 inline-block" />
              <span>swap</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-indigo-400 inline-block" />
              <span>Extendida (EBR)</span>
            </span>
          </div>
        </div>

        {/* Visual Horizontal Disk Bar */}
        <div className="flex items-stretch gap-1.5 min-h-[138px] w-full overflow-x-auto pb-1">
          {/* Sector 0 / Primary Partition Table Header Block */}
          <div
            className="w-16 shrink-0 rounded-lg border border-slate-700/80 bg-slate-950 p-2 flex flex-col justify-between text-center select-none"
            title={
              disk.partitionTable === 'MBR'
                ? 'LBA 0: Master Boot Record (440B código arranque + 64B tabla 4 particiones + 2B firma 0x55AA)'
                : disk.partitionTable === 'GPT'
                  ? 'LBA 0 MBR Protector + LBA 1 Cabecera GPT Primaria + LBA 2..33 Array de 128 entradas GUID'
                  : 'Sector 0 sin firma de particionado (RAW)'
            }
          >
            <div className="text-[10px] font-mono text-slate-400">LBA 0</div>
            <div className="text-xs font-mono font-bold text-slate-200">
              {disk.partitionTable === 'MBR'
                ? 'MBR'
                : disk.partitionTable === 'GPT'
                  ? 'GPT 1ª'
                  : 'RAW'}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {disk.partitionTable === 'MBR'
                ? '512 B'
                : disk.partitionTable === 'GPT'
                  ? '17 KB'
                  : 'Vacío'}
            </div>
          </div>

          {/* Top-Level Partitions */}
          {topLevelPartitions.map((part) => {
            const isSelected = part.id === selectedPartitionId;

            if (part.role === 'extended') {
              const style = FS_VISUAL_STYLE.EXTENDED;
              return (
                <div
                  key={part.id}
                  style={{ flexGrow: getVisualFlexGrow(part.sizeMB) }}
                  onClick={() => onSelectPartition(part.id)}
                  className={`min-w-[220px] rounded-lg border-2 p-2.5 flex flex-col justify-between cursor-pointer transition-all ${
                    style.bg
                  } ${
                    isSelected
                      ? 'border-indigo-400 ring-2 ring-indigo-400/30'
                      : style.border
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-mono font-semibold text-indigo-200 truncate">
                      {getLinuxDevName(part.number)} · Contenedor Extendido
                    </span>
                    <span className="text-xs font-mono tabular-nums text-indigo-300 shrink-0">
                      {formatCapacity(part.sizeMB).split(' (')[0]}
                    </span>
                  </div>

                  {/* Nested Logical Volumes inside Extended Container */}
                  <div className="flex items-stretch gap-1.5 flex-1 min-h-[76px]">
                    {logicalPartitions.map((logPart) => {
                      const logStyle = FS_VISUAL_STYLE[logPart.fileSystem];
                      const isLogSelected = logPart.id === selectedPartitionId;
                      return (
                        <div
                          key={logPart.id}
                          style={{
                            flexGrow: Math.max(
                              15,
                              Math.round((logPart.sizeMB / part.sizeMB) * 100)
                            ),
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPartition(logPart.id);
                          }}
                          className={`min-w-[115px] rounded border overflow-hidden flex flex-col justify-between transition-all ${
                            logStyle.bg
                          } ${
                            isLogSelected
                              ? 'border-white ring-2 ring-sky-400/40'
                              : logStyle.border
                          }`}
                        >
                          <div className={`h-1.5 w-full ${logStyle.topBar}`} />
                          <div className="p-2 flex flex-col justify-between flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-white truncate">
                                {logPart.driveLetter ? `${logPart.driveLetter} ` : ''}
                                {logPart.label || `Lógica ${logPart.number}`}
                              </span>
                              <span className="text-[11px] font-mono text-slate-300 shrink-0">
                                #{logPart.number}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-300 mt-1">
                              <span>{logPart.fileSystem} (Lógica)</span>
                              <span>{formatCapacity(logPart.sizeMB).split(' (')[0]}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {space.extendedFreeMB > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCreateModal('logical');
                        }}
                        style={{
                          flexGrow: Math.max(
                            15,
                            Math.round((space.extendedFreeMB / part.sizeMB) * 100)
                          ),
                        }}
                        className="min-w-[115px] rounded border border-dashed border-indigo-400/40 bg-slate-950/60 hover:bg-indigo-950/40 p-2 flex flex-col items-center justify-center text-center transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-300 mb-0.5" />
                        <span className="text-[11px] font-medium text-indigo-200 whitespace-nowrap">
                          + Unidad Lógica
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400">
                          {formatCapacity(space.extendedFreeMB).split(' (')[0]} libres
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            const style =
              part.role === 'msr'
                ? FS_VISUAL_STYLE.MSR
                : FS_VISUAL_STYLE[part.fileSystem];
            const usage = calculatePartitionUsage(part);

            return (
              <div
                key={part.id}
                style={{ flexGrow: getVisualFlexGrow(part.sizeMB) }}
                onClick={() => onSelectPartition(part.id)}
                className={`min-w-[138px] rounded-lg border overflow-hidden flex flex-col justify-between cursor-pointer transition-all ${
                  style.bg
                } ${
                  isSelected
                    ? 'border-white ring-2 ring-sky-400/40'
                    : style.border
                }`}
              >
                <div className={`h-2 w-full ${style.topBar}`} />
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-slate-300 truncate">
                        {part.role === 'efi'
                          ? 'EFI ESP'
                          : part.role === 'msr'
                            ? 'MSR'
                            : getLinuxDevName(part.number)}
                        {part.isActive ? ' · ACTIVA' : ''}
                      </span>
                      <span className={`text-xs font-mono font-bold ${style.textAccent}`}>
                        {part.role === 'msr' ? 'MSR' : part.fileSystem}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white truncate">
                      {part.driveLetter ? `${part.driveLetter} ` : ''}
                      {part.label || '(Sin etiqueta)'}
                    </div>
                  </div>

                  <div className="pt-2.5 space-y-1.5">
                    {part.fileSystem !== 'RAW' && part.role !== 'msr' && (
                      <div className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${style.topBar}`}
                          style={{ width: `${Math.max(4, usage.usedPercent)}%` }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-300">
                      <span>{formatCapacity(part.sizeMB).split(' (')[0]}</span>
                      <span className="text-slate-400">
                        {part.role === 'msr'
                          ? 'Reservado'
                          : part.fileSystem === 'RAW'
                            ? 'Sin formato'
                            : `Clúster ${
                                part.clusterSize >= 1024
                                  ? `${part.clusterSize / 1024}KB`
                                  : `${part.clusterSize}B`
                              }`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Unallocated Addressable Space Block */}
          {space.unallocatedAddressableMB > 0 && (
            <div
              style={{ flexGrow: getVisualFlexGrow(space.unallocatedAddressableMB) }}
              className="min-w-[155px] rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-3 flex flex-col justify-between"
            >
              <div>
                <div className="text-xs font-mono text-slate-400">
                  ESPACIO NO ASIGNADO
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-200 mt-0.5">
                  {formatCapacity(space.unallocatedAddressableMB)}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {disk.partitionTable === 'RAW'
                    ? 'Inicializa en MBR o GPT'
                    : 'Disponible para particionar'}
                </span>
                {disk.partitionTable !== 'RAW' && (
                  <button
                    type="button"
                    onClick={() => onOpenCreateModal('primary')}
                    className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Crear Partición
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Locked > 2 TB MBR 32-Bit LBA Barrier Block */}
          {space.mbrLockedOver2TBMB > 0 && (
            <div
              style={{ flexGrow: getVisualFlexGrow(space.mbrLockedOver2TBMB) }}
              className="min-w-[190px] rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-mono font-semibold text-rose-300 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    BLOQUEADO POR LÍMITE MBR 2 TB
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-rose-200 mt-0.5">
                    {formatCapacity(space.mbrLockedOver2TBMB)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-rose-200/80 leading-snug pt-2">
                Inaccesible en MBR (2³² sectores × 512 B = 2 TB máx.). Convierte el disco a GPT para desbloquear.
              </p>
            </div>
          )}

          {/* GPT Backup Header at End of Disk */}
          {disk.partitionTable === 'GPT' && (
            <div
              className="w-16 shrink-0 rounded-lg border border-slate-700/80 bg-slate-950 p-2 flex flex-col justify-between text-center select-none"
              title="Últimos 33 sectores LBA: Copia de seguridad secundaria de la tabla y cabecera GPT con suma de verificación CRC32 para recuperación ante corrupción."
            >
              <div className="text-[10px] font-mono text-slate-400">LBA Fin</div>
              <div className="text-xs font-mono font-bold text-sky-300">
                GPT 2ª
              </div>
              <div className="text-[10px] font-mono text-slate-400">Backup</div>
            </div>
          )}
        </div>

        {/* High-Density Partition Table */}
        <div className="overflow-x-auto border-t border-slate-800 pt-3">
          {disk.partitions.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              No existen particiones creadas en {disk.name} ({disk.partitionTable}).{' '}
              {disk.partitionTable === 'RAW'
                ? 'Inicializa primero la tabla de particiones en MBR o GPT.'
                : 'Pulsa "Nueva Partición" o usa el comando CREATE PARTITION en la consola.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 px-3">Dispositivo</th>
                  <th className="py-2 px-3">Volumen / Etiqueta</th>
                  <th className="py-2 px-3">Tipo Esquema</th>
                  <th className="py-2 px-3">Sistema Archivos</th>
                  <th className="py-2 px-3 text-right">Capacidad</th>
                  <th className="py-2 px-3 text-right">Tamaño Clúster</th>
                  <th className="py-2 px-3 text-right">Ocupado (Físico / Slack)</th>
                  <th className="py-2 px-3">Estado Arranque</th>
                  <th className="py-2 px-3 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {disk.partitions.map((part) => {
                  const isSelected = part.id === selectedPartitionId;
                  const usage = calculatePartitionUsage(part);
                  return (
                    <tr
                      key={part.id}
                      onClick={() => onSelectPartition(part.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 text-white'
                          : 'hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        P{part.number}{' '}
                        <span className="text-slate-400 font-normal">
                          ({getLinuxDevName(part.number)})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-white">
                        {part.driveLetter ? (
                          <span className="font-mono text-sky-300 mr-1.5">
                            [{part.driveLetter}]
                          </span>
                        ) : null}
                        {part.label || '(Sin etiqueta)'}
                      </td>
                      <td className="py-2.5 px-3">
                        {part.role === 'primary' && 'Primaria'}
                        {part.role === 'extended' && 'Extendida (EBR)'}
                        {part.role === 'logical' && 'Unidad Lógica'}
                        {part.role === 'efi' && 'Sistema EFI (ESP)'}
                        {part.role === 'msr' && 'Microsoft Reserved'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {part.role === 'extended'
                          ? 'Contenedor'
                          : part.role === 'msr'
                            ? 'MSR (RAW)'
                            : part.fileSystem}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {formatCapacity(part.sizeMB)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {part.role === 'extended' ||
                        part.role === 'msr' ||
                        part.fileSystem === 'RAW'
                          ? '—'
                          : part.clusterSize >= 1024
                            ? `${part.clusterSize / 1024} KB (${part.clusterSize} B)`
                            : `${part.clusterSize} B`}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {part.role === 'extended' ||
                        part.role === 'msr' ||
                        part.fileSystem === 'RAW' ? (
                          '—'
                        ) : (
                          <span>
                            {formatBytes(usage.physicalUsedBytes)}
                            {usage.slackTotalBytes > 0 && (
                              <span className="text-amber-300 ml-1">
                                (Slack: {formatBytes(usage.slackTotalBytes)})
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {part.role === 'efi' ? (
                          <span className="text-emerald-300 flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5" />
                            Boot UEFI (ESP)
                          </span>
                        ) : part.isActive ? (
                          <span className="text-sky-300 font-semibold">
                            Activa (0x80 MBR)
                          </span>
                        ) : (
                          <span className="text-slate-500">Estándar</span>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          {disk.partitionTable === 'MBR' &&
                            part.role === 'primary' && (
                              <button
                                type="button"
                                onClick={() => onToggleActive(part.id)}
                                className="px-2 py-1 rounded border border-slate-700 hover:border-sky-500/50 bg-slate-900 text-[11px] font-sans text-slate-200 hover:text-sky-300 transition-colors whitespace-nowrap"
                              >
                                {part.isActive ? 'Quitar Activa' : 'Marcar Activa'}
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => onDeletePartition(part.id)}
                            className="p-1 rounded border border-slate-700 hover:border-rose-500/50 bg-slate-900 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Eliminar partición"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
