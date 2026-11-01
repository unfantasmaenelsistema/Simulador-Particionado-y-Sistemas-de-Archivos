import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  FilePlus2,
  Layers,
  Trash2,
} from 'lucide-react';
import {
  ClusterSize,
  Disk,
  FAT32_MAX_FILE_BYTES,
  NTFS_MFT_RESIDENT_THRESHOLD_BYTES,
  Partition,
  PRESET_TEST_FILES,
  VirtualFile,
} from '../types/storage';
import {
  calculateFileAllocation,
  calculatePartitionUsage,
  formatBytes,
} from '../utils/diskEngine';

interface ClusterSimulatorProps {
  activeDisk: Disk;
  selectedPartition: Partition | null;
  onSelectPartition: (id: string) => void;
  onAddFileToPartition: (partitionId: string, file: VirtualFile) => {
    valid: boolean;
    error?: string;
  };
  onRemoveFileFromPartition: (partitionId: string, fileId: string) => void;
}

const CLUSTER_SIZES: ClusterSize[] = [512, 4096, 16384, 32768, 65536];

export const ClusterSimulator: React.FC<ClusterSimulatorProps> = ({
  activeDisk,
  selectedPartition,
  onSelectPartition,
  onAddFileToPartition,
  onRemoveFileFromPartition,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    PRESET_TEST_FILES[0].id
  );
  const [customName, setCustomName] = useState<string>('registro_auditoria.log');
  const [customSizeValue, setCustomSizeValue] = useState<number>(1.5);
  const [customSizeUnit, setCustomSizeUnit] = useState<'B' | 'KB' | 'MB' | 'GB'>('KB');
  const [customCount, setCustomCount] = useState<number>(5000);
  const [useCustomFile, setUseCustomFile] = useState<boolean>(false);
  const [sandboxClusterSize, setSandboxClusterSize] = useState<ClusterSize>(
    selectedPartition?.clusterSize || 4096
  );
  const [simulateMftResidency, setSimulateMftResidency] =
    useState<boolean>(true);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const activeClusterSize: ClusterSize =
    selectedPartition &&
    selectedPartition.fileSystem !== 'RAW' &&
    selectedPartition.role !== 'extended' &&
    selectedPartition.role !== 'msr'
      ? selectedPartition.clusterSize
      : sandboxClusterSize;

  const getActiveTestFile = (): VirtualFile => {
    if (!useCustomFile) {
      return (
        PRESET_TEST_FILES.find((f) => f.id === selectedPresetId) ||
        PRESET_TEST_FILES[0]
      );
    }
    const multiplier =
      customSizeUnit === 'GB'
        ? 1024 * 1024 * 1024
        : customSizeUnit === 'MB'
          ? 1024 * 1024
          : customSizeUnit === 'KB'
            ? 1024
            : 1;
    return {
      id: `custom-${Date.now()}`,
      name: customName.trim() || 'archivo_prueba.dat',
      sizeBytes: Math.max(1, Math.round(customSizeValue * multiplier)),
      count: Math.max(1, Math.min(100000, Math.round(customCount))),
      category: 'custom',
    };
  };

  const activeFile = getActiveTestFile();
  const targetFs = selectedPartition?.fileSystem || 'NTFS';

  const currentMetrics = calculateFileAllocation(
    activeFile.sizeBytes,
    activeFile.count,
    activeClusterSize,
    targetFs,
    simulateMftResidency
  );

  // Compute how the last cluster of a SINGLE file is filled
  const remainderInLastCluster = currentMetrics.isMftResident
    ? activeFile.sizeBytes
    : activeFile.sizeBytes % activeClusterSize === 0
      ? activeClusterSize
      : activeFile.sizeBytes % activeClusterSize;

  const lastClusterFillPercent = currentMetrics.isMftResident
    ? 100
    : Math.round((remainderInLastCluster / activeClusterSize) * 100);

  const slackPerSingleFile = currentMetrics.isMftResident
    ? 0
    : currentMetrics.clustersPerFile * activeClusterSize - activeFile.sizeBytes;

  const handleWriteToPartition = () => {
    if (!selectedPartition) {
      setFeedback({
        type: 'error',
        message:
          'Selecciona primero una partición formateada en el disco activo para escribir el archivo.',
      });
      return;
    }

    const fileToWrite: VirtualFile = {
      ...activeFile,
      id: `${activeFile.id}-${Date.now()}`,
    };

    const result = onAddFileToPartition(selectedPartition.id, fileToWrite);
    if (!result.valid) {
      setFeedback({
        type: 'error',
        message: result.error || 'No se pudo almacenar el archivo en la partición.',
      });
    } else {
      setFeedback({
        type: 'success',
        message: currentMetrics.isMftResident
          ? `Archivo "${fileToWrite.name}" (${fileToWrite.count.toLocaleString(
              'es-ES'
            )} archivos de ${activeFile.sizeBytes} B) alojado como Atributo Residente dentro de la tabla MFT de NTFS (0 clústeres de datos adicionales y 0 bytes de Slack Space).`
          : `Archivo "${fileToWrite.name}" (${
              fileToWrite.count > 1
                ? `${fileToWrite.count.toLocaleString('es-ES')} archivos, `
                : ''
            }tamaño lógico: ${formatBytes(
              currentMetrics.logicalSizeBytes
            )}) escrito en [${
              selectedPartition.driveLetter ||
              `Partición ${selectedPartition.number}`
            }]. Espacio físico ocupado en clústeres: ${formatBytes(
              currentMetrics.physicalSizeOnDiskBytes
            )} (Slack Space desperdiciado: ${formatBytes(
              currentMetrics.slackSpaceBytes
            )}).`,
      });
    }
  };

  const partitionUsage = selectedPartition
    ? calculatePartitionUsage(selectedPartition)
    : null;

  return (
    <div className="space-y-6">
      {/* Top Partition Target Selector + Status */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              Laboratorio de Clústeres, Límite 4 GB FAT32, Slack Space y Atributos Residentes MFT
            </h2>
            <p className="text-xs text-slate-400">
              Experimenta cómo la unidad de asignación (clúster/bloque) determina el espacio real en disco, verifica la barrera de 4 GB en FAT32 y comprueba cómo NTFS aloja microarchivos (&le;700 B) dentro de la MFT.
            </p>
          </div>

          {/* Select Target Partition on Active Disk */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400">
              Volumen destino ({activeDisk.name}):
            </span>
            {activeDisk.partitions.length === 0 ? (
              <span className="text-xs font-mono text-rose-300">
                Sin particiones en {activeDisk.name}
              </span>
            ) : (
              activeDisk.partitions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPartition(p.id);
                    setFeedback(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 border ${
                    selectedPartition?.id === p.id
                      ? 'bg-sky-500/20 border-sky-400 text-white font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  P{p.number}: {p.driveLetter || p.label} ({p.fileSystem}
                  {p.fileSystem !== 'RAW' &&
                  p.role !== 'extended' &&
                  p.role !== 'msr'
                    ? ` · ${p.clusterSize >= 1024 ? `${p.clusterSize / 1024}KB` : `${p.clusterSize}B`}`
                    : ''}
                  )
                </button>
              ))
            )}
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div
            className={`rounded-lg border p-3.5 flex items-start gap-3 text-xs leading-relaxed ${
              feedback.type === 'error'
                ? 'bg-rose-950/35 border-rose-500/50 text-rose-100'
                : 'bg-emerald-950/35 border-emerald-500/50 text-emerald-100'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold">
                {feedback.type === 'error'
                  ? 'Operación de Escritura Rechazada por el Sistema de Archivos'
                  : 'Escritura en Clústeres Completada'}
              </div>
              <p>{feedback.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main 2-Zone Sandbox: File Builder (Left) + Live Cluster Anatomy & Comparison (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: File Workload Selector */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              1. Seleccionar Carga de Archivos a Almacenar
            </h3>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setUseCustomFile(false)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  !useCustomFile
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Casos Reales
              </button>
              <button
                type="button"
                onClick={() => setUseCustomFile(true)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  useCustomFile
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {!useCustomFile ? (
            <div className="space-y-2.5">
              {PRESET_TEST_FILES.map((preset) => {
                const isSelected = preset.id === selectedPresetId;
                const exceedsFat32 = preset.sizeBytes > FAT32_MAX_FILE_BYTES;
                const isMftCandidate =
                  preset.sizeBytes <= NTFS_MFT_RESIDENT_THRESHOLD_BYTES;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-sky-950/40 border-sky-500/60 text-white'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-sky-300 truncate">
                        {preset.name}
                      </span>
                      <span className="font-mono text-xs tabular-nums font-semibold text-white shrink-0">
                        {preset.count > 1
                          ? `${preset.count.toLocaleString('es-ES')} × ${formatBytes(preset.sizeBytes)}`
                          : formatBytes(preset.sizeBytes)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>
                        Tamaño lógico total:{' '}
                        {formatBytes(preset.sizeBytes * preset.count)}
                      </span>
                      {exceedsFat32 ? (
                        <span className="text-amber-300 font-mono">
                          Supera límite 4 GB FAT32
                        </span>
                      ) : isMftCandidate ? (
                        <span className="text-emerald-300 font-mono">
                          &le;700B: Residente en MFT (NTFS)
                        </span>
                      ) : preset.count >= 1000 ? (
                        <span className="text-sky-300 font-mono">
                          Prueba de Slack Space masivo
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nombre del archivo
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tamaño por archivo: {customSizeValue} {customSizeUnit}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={customSizeValue}
                      onChange={(e) =>
                        setCustomSizeValue(
                          Math.max(0.1, parseFloat(e.target.value) || 1)
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-white focus:border-sky-500 focus:outline-none"
                    />
                    <select
                      value={customSizeUnit}
                      onChange={(e) =>
                        setCustomSizeUnit(
                          e.target.value as 'B' | 'KB' | 'MB' | 'GB'
                        )
                      }
                      className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                    >
                      <option value="B">B</option>
                      <option value="KB">KB</option>
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cantidad de archivos ({customCount.toLocaleString('es-ES')})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={customCount}
                    onChange={(e) =>
                      setCustomCount(
                        Math.max(1, parseInt(e.target.value, 10) || 1)
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* NTFS MFT Resident Toggle Explanation */}
          {activeFile.sizeBytes <= NTFS_MFT_RESIDENT_THRESHOLD_BYTES && (
            <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/40 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  Optimización NTFS: Archivo Residente en MFT (&le;700 B)
                </span>
                <button
                  type="button"
                  onClick={() => setSimulateMftResidency(!simulateMftResidency)}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-mono text-emerald-200"
                >
                  {simulateMftResidency ? 'MFT Residente: ON' : 'MFT Residente: OFF'}
                </button>
              </div>
              <p className="text-slate-300 leading-relaxed">
                En NTFS cada archivo tiene un registro de 1 KB en la Master File Table (MFT). Si el archivo mide &le;700 bytes, sus datos se guardan directamente dentro del atributo <code>$DATA</code> del registro MFT, consumiendo <strong>0 clústeres externos</strong> y <strong>0 bytes de Slack Space</strong> (a diferencia de FAT32/exFAT/ext4).
              </p>
            </div>
          )}

          {/* Action button to write file to selected partition */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <button
              type="button"
              onClick={handleWriteToPartition}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <FilePlus2 className="w-4 h-4" />
              Escribir Archivo en{' '}
              {selectedPartition
                ? `Partición ${selectedPartition.number} (${selectedPartition.fileSystem})`
                : 'Partición Seleccionada'}
            </button>

            {/* Files currently stored inside the selected partition */}
            {selectedPartition && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Archivos almacenados en P{selectedPartition.number} (
                    {selectedPartition.fileSystem}):
                  </span>
                  {partitionUsage && (
                    <span className="font-mono tabular-nums text-slate-300">
                      Libre: {formatBytes(partitionUsage.freeBytes)}
                    </span>
                  )}
                </div>

                {selectedPartition.files.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">
                    No hay archivos de usuario en esta partición.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {selectedPartition.files.map((f) => {
                      const alloc = calculateFileAllocation(
                        f.sizeBytes,
                        f.count,
                        selectedPartition.clusterSize,
                        selectedPartition.fileSystem,
                        true
                      );
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums"
                        >
                          <div className="truncate">
                            <div className="text-slate-200 font-semibold truncate">
                              {f.name}{' '}
                              {f.count > 1
                                ? `(${f.count.toLocaleString('es-ES')}x)`
                                : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Lógico: {formatBytes(alloc.logicalSizeBytes)} · En disco:{' '}
                              <span className="text-sky-300">
                                {formatBytes(alloc.physicalSizeOnDiskBytes)}
                              </span>{' '}
                              · Slack:{' '}
                              <span className="text-amber-300">
                                {alloc.isMftResident
                                  ? '0 B (MFT Residente)'
                                  : formatBytes(alloc.slackSpaceBytes)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onRemoveFileFromPartition(
                                selectedPartition.id,
                                f.id
                              )
                            }
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors shrink-0"
                            title="Eliminar archivo del volumen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cluster Anatomy Visualizer & Multi-Cluster Matrix */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                2. Anatomía Física de Asignación de Clústeres ({targetFs})
              </h3>
              <p className="text-xs text-slate-400">
                Cada clúster es indivisible: el espacio sobrante al final del último clúster de cada archivo no puede ser usado por otro archivo (Slack Space).
              </p>
            </div>

            {/* Sandbox Cluster Size Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {CLUSTER_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSandboxClusterSize(size)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                    activeClusterSize === size
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {size >= 1024 ? `${size / 1024} KB` : `${size} B`}
                </button>
              ))}
            </div>
          </div>

          {/* 4-Metric Mathematical Breakdown Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Tamaño Lógico Real</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {formatBytes(currentMetrics.logicalSizeBytes)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {activeFile.count.toLocaleString('es-ES')} archivo(s)
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Clústeres Ocupados</div>
              <div className="text-sm font-bold text-sky-300 mt-0.5">
                {currentMetrics.isMftResident
                  ? '0 (En MFT)'
                  : currentMetrics.totalClustersOccupied.toLocaleString('es-ES')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {currentMetrics.isMftResident
                  ? 'Atributo $DATA residente'
                  : `${currentMetrics.clustersPerFile.toLocaleString('es-ES')} clúster/archivo`}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Tamaño en Disco</div>
              <div className="text-sm font-bold text-emerald-300 mt-0.5">
                {formatBytes(currentMetrics.physicalSizeOnDiskBytes)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Eficiencia: {currentMetrics.efficiencyPercent.toFixed(1)}%
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Slack Desperdiciado</div>
              <div className="text-sm font-bold text-amber-300 mt-0.5">
                {formatBytes(currentMetrics.slackSpaceBytes)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {formatBytes(slackPerSingleFile)} / archivo
              </div>
            </div>
          </div>

          {/* Visual Representation of the File's Clusters */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-200">
                {currentMetrics.isMftResident
                  ? `Alojamiento Directo en Registro MFT de 1 KB ("${activeFile.name}")`
                  : `Mapa de Ocupación dentro del Último Clúster de "${activeFile.name}" (Clúster de ${
                      activeClusterSize >= 1024
                        ? `${activeClusterSize / 1024} KB`
                        : `${activeClusterSize} B`
                    })`}
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                Datos útiles: {formatBytes(remainderInLastCluster)} (
                {lastClusterFillPercent}%) · Slack Space:{' '}
                {currentMetrics.isMftResident
                  ? '0 B (0%)'
                  : `${formatBytes(
                      activeClusterSize - remainderInLastCluster
                    )} (${100 - lastClusterFillPercent}%)`}
              </span>
            </div>

            {/* Single Cluster Zoom Bar */}
            <div className="h-9 w-full rounded-lg border border-slate-700 overflow-hidden flex font-mono text-xs">
              <div
                style={{ width: `${Math.max(8, lastClusterFillPercent)}%` }}
                className="bg-sky-600/80 text-white flex items-center justify-center px-2 truncate"
              >
                {currentMetrics.isMftResident
                  ? `Atributo $DATA Residente en MFT (${activeFile.sizeBytes} B — 0% Slack)`
                  : `Datos (${lastClusterFillPercent}%)`}
              </div>
              {lastClusterFillPercent < 100 && (
                <div
                  style={{ width: `${100 - lastClusterFillPercent}%` }}
                  className="bg-amber-500/25 text-amber-200 border-l border-amber-500/40 flex items-center justify-center px-2 truncate"
                >
                  Slack Space Desperdiciado ({100 - lastClusterFillPercent}%)
                </div>
              )}
            </div>
          </div>

          {/* Comparison Table Across All Cluster Sizes */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-200">
              Comparativa de Impacto según Tamaño de Clúster (Unidad de Asignación Estándar)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2.5">Tamaño Clúster</th>
                    <th className="py-2 px-2.5 text-right">Clústeres Totales</th>
                    <th className="py-2 px-2.5 text-right">Ocupado en Disco</th>
                    <th className="py-2 px-2.5 text-right">Slack Desperdiciado</th>
                    <th className="py-2 px-2.5 text-right">Eficiencia</th>
                    <th className="py-2 px-2.5">Uso Ideal Recomendado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {CLUSTER_SIZES.map((cSize) => {
                    const m = calculateFileAllocation(
                      activeFile.sizeBytes,
                      activeFile.count,
                      cSize
                    );
                    const isCurrent = cSize === activeClusterSize;
                    return (
                      <tr
                        key={cSize}
                        onClick={() => setSandboxClusterSize(cSize)}
                        className={`cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-sky-500/15 text-white font-semibold'
                            : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-2.5 text-sky-300">
                          {cSize >= 1024 ? `${cSize / 1024} KB` : `${cSize} B`}
                          {cSize === 4096 ? ' (Estándar)' : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          {m.totalClustersOccupied.toLocaleString('es-ES')}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          {formatBytes(m.physicalSizeOnDiskBytes)}
                        </td>
                        <td className="py-2 px-2.5 text-right text-amber-300">
                          {formatBytes(m.slackSpaceBytes)}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span
                            className={
                              m.efficiencyPercent >= 85
                                ? 'text-emerald-300'
                                : m.efficiencyPercent >= 50
                                  ? 'text-amber-300'
                                  : 'text-rose-300'
                            }
                          >
                            {m.efficiencyPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-sans text-slate-400">
                          {cSize === 512 && 'Mínimo Slack, alto overhead de tabla'}
                          {cSize === 4096 && 'Equilibrio óptimo SO general (NTFS/ext4)'}
                          {cSize === 16384 && 'Memorias USB y almacenamiento mixto'}
                          {cSize === 32768 && 'Estándar exFAT y bibliotecas multimedia'}
                          {cSize === 65536 && 'ISOs, vídeo 4K/8K, discos VHDX/SQL'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
