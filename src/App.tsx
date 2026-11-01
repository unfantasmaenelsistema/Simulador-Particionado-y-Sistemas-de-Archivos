import React, { useMemo, useState } from 'react';
import {
  ArrowsUpFromLine,
  CheckCircle2,
  Compass,
  Cpu,
  Disc,
  ExternalLink,
  HardDrive,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import {
  ClusterSize,
  Disk,
  FileSystemType,
  FirmwareType,
  PartitionRole,
  TerminalEntry,
  VirtualFile,
} from './types/storage';
import {
  calculateDiskSpace,
  CHALLENGE_SCENARIOS,
  createInitialDisks,
  evaluateBootDiagnostic,
  evaluateChallenge,
  executeDiskpartCommand,
  formatCapacity,
  validateAddFileToPartition,
} from './utils/diskEngine';
import { DiskVisualizer } from './components/DiskVisualizer';
import { ConsoleTerminal } from './components/ConsoleTerminal';
import { ClusterSimulator } from './components/ClusterSimulator';
import { ChallengesPanel } from './components/ChallengesPanel';
import { ReferenceGuide } from './components/ReferenceGuide';
import { SectorHexAndBootInspector } from './components/SectorHexAndBootInspector';
import { GuidedTour, TourStep } from './components/GuidedTour';

type ActiveTab = 'workspace' | 'hex-boot' | 'clusters' | 'challenges' | 'guide';

const TOUR_SEEN_KEY = 'simulador-particionado:tour-visto';

export default function App() {
  const [disks, setDisks] = useState<Disk[]>(() => createInitialDisks());
  const [selectedDiskId, setSelectedDiskId] = useState<number>(0);
  const [selectedPartitionId, setSelectedPartitionId] = useState<string | null>(
    'part-0-3'
  );
  const [firmware, setFirmware] = useState<FirmwareType>('UEFI');
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [activeChallengeId, setActiveChallengeId] =
    useState<string>('reto-1-uefi-gpt');

  // Guided Tour State: se abre en la primera visita; tras cerrarlo se recuerda en este navegador
  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TOUR_SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);

  // Create Partition Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newPartRole, setNewPartRole] = useState<PartitionRole>('primary');
  const [newPartSizeMB, setNewPartSizeMB] = useState<number>(51200);
  const [newPartFs, setNewPartFs] = useState<FileSystemType>('NTFS');
  const [newPartCluster, setNewPartCluster] = useState<ClusterSize>(4096);
  const [newPartLabel, setNewPartLabel] = useState<string>('Nuevo-Volumen');
  const [newPartLetter, setNewPartLetter] = useState<string>('F');
  const [modalError, setModalError] = useState<string | null>(null);

  // Selected Partition Quick Format & Resize State
  const [formatFs, setFormatFs] =
    useState<Exclude<FileSystemType, 'RAW'>>('NTFS');
  const [formatCluster, setFormatCluster] = useState<ClusterSize>(4096);
  const [formatLabel, setFormatLabel] = useState<string>('Volumen-Formateado');
  const [formatLetter, setFormatLetter] = useState<string>('C');
  const [resizeAmountMB, setResizeAmountMB] = useState<number>(20480);

  // Terminal Log State
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>(() => [
    {
      id: 'init-1',
      timestamp: new Date().toTimeString().slice(0, 8),
      command: 'list disk',
      linuxEquivalent: 'fdisk -l',
      output: executeDiskpartCommand('list disk', createInitialDisks(), 0, null).output,
      status: 'info',
      source: 'cli',
    },
  ]);

  const activeDisk = useMemo(
    () => disks.find((d) => d.id === selectedDiskId) || disks[0],
    [disks, selectedDiskId]
  );

  const selectedPartition = useMemo(
    () =>
      activeDisk.partitions.find((p) => p.id === selectedPartitionId) || null,
    [activeDisk, selectedPartitionId]
  );

  const bootDiagnostic = useMemo(
    () => evaluateBootDiagnostic(activeDisk, firmware),
    [activeDisk, firmware]
  );

  const activeChallenge = useMemo(
    () =>
      CHALLENGE_SCENARIOS.find((c) => c.id === activeChallengeId) ||
      CHALLENGE_SCENARIOS[0],
    [activeChallengeId]
  );

  const activeChallengeReqs = useMemo(
    () => evaluateChallenge(activeChallenge.id, disks, firmware),
    [activeChallenge.id, disks, firmware]
  );

  const appendLog = (
    command: string,
    output: string,
    status: TerminalEntry['status'],
    source: 'cli' | 'gui',
    linuxEquivalent?: string
  ) => {
    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 8);
    setTerminalEntries((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp,
        command,
        linuxEquivalent,
        output,
        status,
        source,
      },
    ]);
  };

  const runCommandSequence = (
    commands: string[],
    source: 'cli' | 'gui' = 'gui'
  ) => {
    let currentDisks = disks;
    let currDiskId = selectedDiskId;
    let currPartId = selectedPartitionId;

    for (const cmd of commands) {
      const res = executeDiskpartCommand(
        cmd,
        currentDisks,
        currDiskId,
        currPartId
      );
      if (res.clearScreen) {
        setTerminalEntries([]);
        continue;
      }
      currentDisks = res.disks;
      currDiskId = res.selectedDiskId;
      currPartId = res.selectedPartitionId;
      appendLog(cmd, res.output, res.status, source, res.linuxEquivalent);
    }

    setDisks(currentDisks);
    setSelectedDiskId(currDiskId);
    setSelectedPartitionId(currPartId);
  };

  const runCommandAndSync = (cmd: string, source: 'cli' | 'gui' = 'cli') => {
    const res = executeDiskpartCommand(
      cmd,
      disks,
      selectedDiskId,
      selectedPartitionId
    );
    if (res.clearScreen) {
      setTerminalEntries([]);
      return res;
    }
    setDisks(res.disks);
    setSelectedDiskId(res.selectedDiskId);
    setSelectedPartitionId(res.selectedPartitionId);
    appendLog(cmd, res.output, res.status, source, res.linuxEquivalent);
    return res;
  };

  const handleSelectDisk = (diskId: number) => {
    runCommandAndSync(`select disk ${diskId}`, 'gui');
  };

  const handleSelectPartition = (partitionId: string | null) => {
    setSelectedPartitionId(partitionId);
    const found = activeDisk.partitions.find((p) => p.id === partitionId);
    if (found) {
      if (found.fileSystem !== 'RAW') {
        setFormatFs(found.fileSystem);
      }
      setFormatCluster(found.clusterSize);
      setFormatLabel(found.label || 'Volumen');
      setFormatLetter(
        found.driveLetter ? found.driveLetter.replace(':', '') : 'F'
      );
    }
  };

  const handleOpenCreateModal = (defaultRole: PartitionRole = 'primary') => {
    const space = calculateDiskSpace(activeDisk);
    setModalError(null);
    setNewPartRole(defaultRole);
    if (defaultRole === 'efi') {
      setNewPartSizeMB(Math.min(300, space.unallocatedAddressableMB));
      setNewPartFs('FAT32');
      setNewPartCluster(4096);
      setNewPartLabel('EFI-SYSTEM');
      setNewPartLetter('S');
    } else if (defaultRole === 'msr') {
      setNewPartSizeMB(Math.min(16, space.unallocatedAddressableMB));
      setNewPartFs('RAW');
      setNewPartCluster(4096);
      setNewPartLabel('MSR-Reservado');
      setNewPartLetter('');
    } else if (defaultRole === 'logical') {
      setNewPartSizeMB(Math.min(51200, space.extendedFreeMB));
      setNewPartFs('NTFS');
      setNewPartCluster(4096);
      setNewPartLabel('Volumen-Logico');
      setNewPartLetter('G');
    } else if (defaultRole === 'extended') {
      setNewPartSizeMB(Math.min(204800, space.unallocatedAddressableMB));
      setNewPartFs('RAW');
      setNewPartLabel('Contenedor-Extendida');
    } else {
      setNewPartSizeMB(Math.min(102400, space.unallocatedAddressableMB));
      setNewPartFs('NTFS');
      setNewPartCluster(4096);
      setNewPartLabel('Datos');
      setNewPartLetter('F');
    }
    setIsCreateModalOpen(true);
  };

  const handleCreatePartitionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const createCmd = `create partition ${newPartRole} size=${Math.round(
      newPartSizeMB
    )}`;
    const createRes = executeDiskpartCommand(
      createCmd,
      disks,
      selectedDiskId,
      selectedPartitionId
    );

    if (createRes.status === 'error') {
      setModalError(createRes.output);
      appendLog(
        createCmd,
        createRes.output,
        'error',
        'gui',
        createRes.linuxEquivalent
      );
      return;
    }

    let updatedDisks = createRes.disks;
    let newPartId = createRes.selectedPartitionId;
    appendLog(
      createCmd,
      createRes.output,
      createRes.status,
      'gui',
      createRes.linuxEquivalent
    );

    if (
      newPartRole !== 'extended' &&
      newPartRole !== 'msr' &&
      newPartFs !== 'RAW' &&
      newPartId
    ) {
      const formatCmd = `format fs=${newPartFs.toLowerCase()} unit=${newPartCluster} label="${newPartLabel}" quick`;
      const formatRes = executeDiskpartCommand(
        formatCmd,
        updatedDisks,
        selectedDiskId,
        newPartId
      );
      updatedDisks = formatRes.disks;
      appendLog(
        formatCmd,
        formatRes.output,
        formatRes.status,
        'gui',
        formatRes.linuxEquivalent
      );
      if (formatRes.status === 'error') {
        // La partición queda creada sin formato (como en DiskPart) y se explica por qué
        setDisks(updatedDisks);
        setSelectedPartitionId(newPartId);
        setModalError(
          `La partición se ha creado, pero no se ha podido formatear:\n${formatRes.output}`
        );
        return;
      }

      if (newPartLetter.trim() && newPartFs !== 'swap') {
        const assignCmd = `assign letter=${newPartLetter.trim()}`;
        const assignRes = executeDiskpartCommand(
          assignCmd,
          updatedDisks,
          selectedDiskId,
          newPartId
        );
        updatedDisks = assignRes.disks;
        appendLog(
          assignCmd,
          assignRes.output,
          assignRes.status,
          'gui',
          assignRes.linuxEquivalent
        );
      }
    }

    setDisks(updatedDisks);
    setSelectedPartitionId(newPartId);
    setIsCreateModalOpen(false);
  };

  const handleQuickFormatSelected = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartition) return;

    const selectCmd = `select partition ${selectedPartition.number}`;
    let state = executeDiskpartCommand(
      selectCmd,
      disks,
      selectedDiskId,
      selectedPartition.id
    );

    const fmtCmd = `format fs=${formatFs.toLowerCase()} unit=${formatCluster} label="${
      formatLabel || 'Volumen'
    }" quick`;
    state = executeDiskpartCommand(
      fmtCmd,
      state.disks,
      selectedDiskId,
      selectedPartition.id
    );
    appendLog(fmtCmd, state.output, state.status, 'gui', state.linuxEquivalent);

    if (
      state.status !== 'error' &&
      formatLetter.trim() &&
      formatFs !== 'swap'
    ) {
      const assignCmd = `assign letter=${formatLetter.trim()}`;
      state = executeDiskpartCommand(
        assignCmd,
        state.disks,
        selectedDiskId,
        selectedPartition.id
      );
      appendLog(
        assignCmd,
        state.output,
        state.status,
        'gui',
        state.linuxEquivalent
      );
    }

    setDisks(state.disks);
  };

  const handleResizePartition = (mode: 'shrink' | 'extend') => {
    if (!selectedPartition) return;
    const cmd =
      mode === 'shrink'
        ? `shrink desired=${Math.max(100, Math.round(resizeAmountMB))}`
        : `extend size=${Math.max(100, Math.round(resizeAmountMB))}`;
    runCommandAndSync(cmd, 'gui');
  };

  const handleDeletePartition = (partitionId: string) => {
    const target = activeDisk.partitions.find((p) => p.id === partitionId);
    if (!target) return;

    const state1 = executeDiskpartCommand(
      `select partition ${target.number}`,
      disks,
      selectedDiskId,
      partitionId
    );
    const state2 = executeDiskpartCommand(
      'delete partition',
      state1.disks,
      selectedDiskId,
      partitionId
    );
    setDisks(state2.disks);
    setSelectedPartitionId(state2.selectedPartitionId);
    appendLog(
      `select partition ${target.number} && delete partition`,
      state2.output,
      state2.status,
      'gui',
      state2.linuxEquivalent
    );
  };

  const handleToggleActive = (partitionId: string) => {
    const target = activeDisk.partitions.find((p) => p.id === partitionId);
    if (!target) return;
    const cmd = target.isActive ? 'inactive' : 'active';
    const state = executeDiskpartCommand(
      cmd,
      disks,
      selectedDiskId,
      partitionId
    );
    setDisks(state.disks);
    setSelectedPartitionId(partitionId);
    appendLog(cmd, state.output, state.status, 'gui', state.linuxEquivalent);
  };

  const handleAddFileToPartition = (
    partitionId: string,
    file: VirtualFile
  ): { valid: boolean; error?: string } => {
    const targetPart = activeDisk.partitions.find((p) => p.id === partitionId);
    if (!targetPart) {
      return { valid: false, error: 'Partición no encontrada.' };
    }

    const validation = validateAddFileToPartition(targetPart, file);
    if (!validation.valid) {
      appendLog(
        `write "${file.name}" -> Partición ${targetPart.number} (${targetPart.fileSystem})`,
        validation.error || 'Error al escribir archivo.',
        'error',
        'gui'
      );
      return validation;
    }

    setDisks((prev) =>
      prev.map((d) =>
        d.id === activeDisk.id
          ? {
              ...d,
              partitions: d.partitions.map((p) =>
                p.id === partitionId
                  ? { ...p, files: [...p.files, file] }
                  : p
              ),
            }
          : d
      )
    );

    appendLog(
      `write "${file.name}" (${file.count} archivo[s]) -> Partición ${targetPart.number} (${targetPart.fileSystem})`,
      `Archivo almacenado correctamente en ${targetPart.fileSystem} (clúster ${targetPart.clusterSize} bytes).`,
      'success',
      'gui'
    );

    return { valid: true };
  };

  const handleRemoveFileFromPartition = (
    partitionId: string,
    fileId: string
  ) => {
    setDisks((prev) =>
      prev.map((d) =>
        d.id === activeDisk.id
          ? {
              ...d,
              partitions: d.partitions.map((p) =>
                p.id === partitionId
                  ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
                  : p
              ),
            }
          : d
      )
    );
  };

  const handleResetLaboratory = () => {
    const initial = createInitialDisks();
    setDisks(initial);
    setSelectedDiskId(0);
    setSelectedPartitionId('part-0-3');
    setFirmware('UEFI');
    appendLog(
      'reset laboratory',
      'Todos los discos (Disco 0 NVMe 500GB, Disco 1 HDD 4TB, Disco 2 USB 32GB) se han restaurado a su estado inicial.',
      'info',
      'gui'
    );
  };

  // Evaluate Challenge 1 status for Guided Tour live feedback
  const disk0 = disks.find((d) => d.id === 0)!;
  const r1HasEfiFat32 = disk0.partitions.some(
    (p) =>
      p.role === 'efi' &&
      p.fileSystem === 'FAT32' &&
      p.sizeMB >= 100 &&
      p.sizeMB <= 1024
  );
  const r1HasNtfsC = disk0.partitions.some(
    (p) =>
      p.role === 'primary' &&
      p.fileSystem === 'NTFS' &&
      p.sizeMB >= 102400 &&
      (p.driveLetter?.toUpperCase().startsWith('C') ?? false)
  );
  const r1AllCompleted =
    firmware === 'UEFI' &&
    disk0.partitionTable === 'GPT' &&
    r1HasEfiFat32 &&
    r1HasNtfsC;

  // Guided Tour Steps Definition (Guides the student step-by-step through the UI & Challenge 01)
  const tourSteps: TourStep[] = [
    {
      id: 'tour-step-1-disks',
      targetSelector: 'disk-selector',
      stepNumber: 1,
      title: '1. Selector de Unidades Físicas de Almacenamiento',
      description:
        '¡Bienvenido al Simulador! Aquí dispones de 3 unidades reales: Disco 0 (NVMe 500 GB para sistemas operativos), Disco 1 (HDD 4 TB para experimentar la barrera de 2 TB en MBR) y Disco 2 (USB 32 GB para el límite de 4 GB en FAT32).',
      didacticTip:
        'Para comenzar tu primer reto práctico (Instalación Windows 11 en UEFI/GPT), trabajaremos sobre el Disco 0 (/dev/nvme0n1). Puedes vaciarlo para hacerlo tú mismo paso a paso.',
      actionLabel: 'Seleccionar y Vaciar Disco 0 (CLEAN) para Practicar',
      onAction: () => {
        setActiveTab('workspace');
        setActiveChallengeId('reto-1-uefi-gpt');
        runCommandSequence(['select disk 0', 'clean'], 'gui');
      },
      isStepCompleted: selectedDiskId === 0,
    },
    {
      id: 'tour-step-2-firmware-gpt',
      targetSelector: 'firmware-table-controls',
      stepNumber: 2,
      title: '2. Modo de Firmware (BIOS vs. UEFI) y Tabla (MBR vs. GPT)',
      description:
        'En esta barra defines el firmware de la placa base y el esquema de particionado del disco. Un sistema moderno en modo UEFI exige que el disco de arranque utilice una tabla GPT (64-bit LBA).',
      didacticTip:
        'Si intentas usar UEFI sobre un disco MBR, el instalador rechazará el disco. Asegúrate de tener activado "UEFI Moderno" y pulsa "GPT (64-bit)".',
      actionLabel: 'Configurar UEFI Moderno + Inicializar Disco 0 en GPT',
      onAction: () => {
        setFirmware('UEFI');
        runCommandSequence(['select disk 0', 'convert gpt'], 'gui');
      },
      isStepCompleted: firmware === 'UEFI' && disk0.partitionTable === 'GPT',
    },
    {
      id: 'tour-step-3-visualizer-efi',
      targetSelector: 'disk-visualizer',
      stepNumber: 3,
      title: '3. Mapa de Bloques y Partición del Sistema EFI (ESP)',
      description:
        'Este diagrama estilo GParted / Administración de Discos representa proporcionalmente los sectores LBA y las particiones. En arquitectura UEFI+GPT es obligatorio crear primero una Partición del Sistema EFI (ESP) de 100 a 512 MB formateada en FAT32.',
      didacticTip:
        'La placa base UEFI tiene un controlador nativo FAT32 para leer el cargador \\EFI\\Microsoft\\Boot\\bootmgfw.efi.',
      actionLabel: 'Crear Partición EFI (300 MB) y Formatear en FAT32',
      onAction: () => {
        runCommandSequence(
          [
            'select disk 0',
            'create partition efi size=300',
            'format fs=fat32 label="EFI-SYSTEM" quick',
          ],
          'gui'
        );
      },
      isStepCompleted: r1HasEfiFat32,
    },
    {
      id: 'tour-step-4-operations-ntfs',
      targetSelector: 'partition-operations',
      stepNumber: 4,
      title: '4. Operaciones de Volumen: Crear Partición de Sistema NTFS (C:)',
      description:
        'Desde este panel puedes crear nuevas particiones, formatearlas eligiendo el tamaño de clúster (512 B a 64 KB) o redimensionarlas (SHRINK / EXTEND). Para completar el Reto 01, necesitamos una partición Primaria de al menos 100 GB formateada en NTFS con la letra C:.',
      didacticTip:
        'NTFS utiliza un clúster estándar de 4 KB (4096 B), soporta permisos ACL, Journaling y archivos mayores a 4 GB.',
      actionLabel: 'Crear Partición Primaria (200 GB), Formatear NTFS y Asignar C:',
      onAction: () => {
        runCommandSequence(
          [
            'select disk 0',
            'create partition primary size=204800',
            'format fs=ntfs unit=4096 label="Sistema-Win11" quick',
            'assign letter=C',
          ],
          'gui'
        );
      },
      isStepCompleted: r1HasNtfsC,
    },
    {
      id: 'tour-step-5-challenge-tracker',
      targetSelector: 'challenge-tracker',
      stepNumber: 5,
      title: '5. Verificador de Retos Prácticos en Tiempo Real',
      description:
        'Este panel comprueba automáticamente cada requisito del reto activo conforme realizas cambios en el disco. Cuando todos los indicadores están en verde ("OK"), ¡el reto queda superado!',
      didacticTip:
        'Puedes cambiar entre los 5 retos disponibles desde el selector desplegable o en la pestaña "Retos Prácticos".',
      isStepCompleted: r1AllCompleted,
    },
    {
      id: 'tour-step-6-console-cli',
      targetSelector: 'console-terminal',
      stepNumber: 6,
      title: '6. Consola Dual DISKPART.EXE / GNU Linux (parted & mkfs)',
      description:
        'Todas las acciones gráficas que acabas de realizar se han traducido automáticamente a comandos reales de Microsoft DiskPart y su equivalencia en Linux (parted, mkfs.fat, mkfs.ntfs). También puedes escribir comandos directamente aquí.',
      didacticTip:
        'Explora también las pestañas superiores "Sector 0 Hex & Boot POST" para ver los bytes en hexadecimal y "Simulador Clústeres" para calcular el Slack Space.',
      isStepCompleted: true,
    },
  ];

  const handleStartTour = () => {
    setActiveTab('workspace');
    setActiveChallengeId('reto-1-uefi-gpt');
    setTourStepIndex(0);
    setIsTourOpen(true);
  };

  const diskSpace = calculateDiskSpace(activeDisk);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Interactive Guided Tour Overlay & Tooltips */}
      <GuidedTour
        isOpen={isTourOpen}
        steps={tourSteps}
        currentStepIndex={tourStepIndex}
        onNext={() =>
          setTourStepIndex((prev) => Math.min(tourSteps.length - 1, prev + 1))
        }
        onPrev={() => setTourStepIndex((prev) => Math.max(0, prev - 1))}
        onClose={() => {
          setIsTourOpen(false);
          try {
            localStorage.setItem(TOUR_SEEN_KEY, '1');
          } catch {
            // Sin almacenamiento (modo privado): el tour volverá a abrirse en la próxima visita
          }
        }}
        onGoToStep={(idx) => {
          setActiveTab('workspace');
          setTourStepIndex(idx);
        }}
      />

      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 py-3.5 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        {/* Zone 1: Brand with User Logo (object-contain, never deformed) & Link */}
        <a
          href="https://www.unfantasmaenelsistema.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-sm sm:text-base font-bold tracking-tight text-white hover:text-sky-300 transition-colors min-w-0"
          title="Visitar Un Fantasma en el Sistema (https://www.unfantasmaenelsistema.com/)"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/icono_81a3db5b.png`}
            alt="Logo Un Fantasma en el Sistema"
            referrerPolicy="no-referrer"
            className="h-9 w-auto object-contain shrink-0"
          />
          <span>Simulador DiskPart &amp; Sistemas de Archivos</span>
        </a>

        {/* Zone 2: 5 Single-line Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'workspace'
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Discos y CLI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hex-boot')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'hex-boot'
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Sector 0 Hex &amp; Boot POST
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clusters')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'clusters'
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Simulador Clústeres
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('challenges')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'challenges'
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Retos Prácticos ({CHALLENGE_SCENARIOS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'guide'
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Guía Técnica
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleStartTour}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour Guiado</span>
            <span className="sm:hidden">Tour</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('workspace')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'workspace'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300'
          }`}
        >
          Discos y CLI
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hex-boot')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'hex-boot'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300'
          }`}
        >
          Sector 0 Hex &amp; Boot
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('clusters')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'clusters'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300'
          }`}
        >
          Simulador Clústeres
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('challenges')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'challenges'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300'
          }`}
        >
          Retos Prácticos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'guide'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300'
          }`}
        >
          Guía Técnica
        </button>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hardware & Firmware Selection Strip (Always Visible for Context) */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Physical Disk Selector */}
          <div
            data-tour="disk-selector"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-sky-400" />
              Unidad Física:
            </span>
            {disks.map((d) => {
              const isSelected = d.id === selectedDiskId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSelectDisk(d.id)}
                  className={`px-3.5 py-2 rounded-lg border text-left transition-all flex items-center gap-2.5 whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Disc
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-sky-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold leading-tight">
                      {d.name} ({d.linuxDev}) ·{' '}
                      {formatCapacity(d.totalSizeMB).split(' (')[0]}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Tabla: {d.partitionTable} · {d.partitions.length} part.
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Firmware Mode + Partition Table Controls */}
          <div
            data-tour="firmware-table-controls"
            className="flex flex-wrap items-center gap-3 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-800"
          >
            {/* BIOS/Legacy vs UEFI Switch */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                Firmware:
              </span>
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFirmware('BIOS')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    firmware === 'BIOS'
                      ? 'bg-amber-500/25 border border-amber-500/50 text-amber-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  BIOS / Legacy
                </button>
                <button
                  type="button"
                  onClick={() => setFirmware('UEFI')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    firmware === 'UEFI'
                      ? 'bg-emerald-500/25 border border-emerald-500/50 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  UEFI Moderno
                </button>
              </div>
            </div>

            {/* Partition Table Scheme Converter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono text-slate-400">Tabla:</span>
              <button
                type="button"
                onClick={() => runCommandAndSync('convert mbr', 'gui')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  activeDisk.partitionTable === 'MBR'
                    ? 'bg-sky-500/25 border-sky-400 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
                title="Convertir a MBR (Requiere disco vacío / CLEAN)"
              >
                MBR (32-bit)
              </button>
              <button
                type="button"
                onClick={() => runCommandAndSync('convert gpt', 'gui')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  activeDisk.partitionTable === 'GPT'
                    ? 'bg-sky-500/25 border-sky-400 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
                title="Convertir a GPT (Requiere disco vacío / CLEAN)"
              >
                GPT (64-bit)
              </button>
              <button
                type="button"
                onClick={() => runCommandAndSync('clean', 'gui')}
                className="px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 hover:bg-rose-950/50 text-rose-200 text-xs font-mono inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                title="Ejecutar CLEAN en el disco actual (borra todas las particiones)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                CLEAN
              </button>
              <button
                type="button"
                onClick={handleResetLaboratory}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                title="Restaurar todos los discos a su estado original"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                Restaurar
              </button>
            </div>
          </div>
        </section>

        {/* TAB 1: WORKSPACE (GParted / Disk Management + Inspector + Hex/Boot + DiskPart CLI) */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            {/* Visual Disk Map & Partition Table */}
            <div data-tour="disk-visualizer">
              <DiskVisualizer
                disk={activeDisk}
                firmware={firmware}
                selectedPartitionId={selectedPartitionId}
                bootDiagnostic={bootDiagnostic}
                onSelectPartition={handleSelectPartition}
                onOpenCreateModal={handleOpenCreateModal}
                onDeletePartition={handleDeletePartition}
                onToggleActive={handleToggleActive}
              />
            </div>

            {/* Two-Column Action Deck: Partition Creator/Formatter/Resizer (Left) + Active Challenge Tracker (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Selected Partition Inspector, Formatter & Resizer */}
              <div
                data-tour="partition-operations"
                className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-bold text-white">
                      Operaciones de Particionado, Formateo y Redimensionado
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeDisk.partitionTable !== 'RAW' && (
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal('primary')}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nueva Partición
                      </button>
                    )}
                    {activeDisk.partitionTable === 'GPT' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateModal('efi')}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-950/50 text-xs font-medium text-emerald-200 inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          EFI (ESP)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateModal('msr')}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          MSR (16MB)
                        </button>
                      </>
                    )}
                    {activeDisk.partitionTable === 'MBR' &&
                      !diskSpace.hasExtendedPartition && (
                        <button
                          type="button"
                          onClick={() => handleOpenCreateModal('extended')}
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-400/40 bg-indigo-950/30 hover:bg-indigo-950/50 text-xs font-medium text-indigo-200 inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Crear Extendida
                        </button>
                      )}
                  </div>
                </div>

                {!selectedPartition ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Selecciona una partición en el mapa superior para formatearla en NTFS, FAT32, exFAT, ext4 o Linux Swap, ajustar su tamaño de clúster o redimensionarla.
                  </div>
                ) : selectedPartition.role === 'extended' ? (
                  <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-500/30 space-y-2 text-xs">
                    <div className="font-bold text-indigo-200">
                      Partición {selectedPartition.number}: Contenedor Extendido MBR ({formatCapacity(selectedPartition.sizeMB)})
                    </div>
                    <p className="text-slate-300">
                      Una Partición Extendida es una estructura contenedora EBR (Extended Boot Record) para superar el límite de 4 particiones primarias de MBR. No puede formatearse directamente: crea Unidades Lógicas dentro de ella.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal('logical')}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Crear Unidad Lógica dentro de la Extendida
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <form
                      onSubmit={handleQuickFormatSelected}
                      className="space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300 bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800">
                        <span>
                          Seleccionada: <strong>Partición {selectedPartition.number}</strong> ({selectedPartition.role.toUpperCase()})
                        </span>
                        <span>
                          Tamaño: <strong>{formatCapacity(selectedPartition.sizeMB)}</strong> · Formato actual:{' '}
                          <strong className="text-sky-300">
                            {selectedPartition.fileSystem}
                          </strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Sistema de Archivos
                          </label>
                          <select
                            value={formatFs}
                            onChange={(e) =>
                              setFormatFs(
                                e.target.value as Exclude<FileSystemType, 'RAW'>
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                          >
                            <option value="NTFS">NTFS (Windows / MFT)</option>
                            <option value="FAT32">FAT32 (UEFI ESP / Máx 4GB)</option>
                            <option value="exFAT">exFAT (Flash/USB &gt;4GB)</option>
                            <option value="ext4">ext4 (Linux Inodos)</option>
                            <option value="swap">swap (Linux Memoria Virtual)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Tamaño de Clúster / Bloque
                          </label>
                          <select
                            value={formatCluster}
                            onChange={(e) =>
                              setFormatCluster(
                                parseInt(e.target.value, 10) as ClusterSize
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                          >
                            <option value={512}>512 Bytes (Sector nativo)</option>
                            <option value={4096}>4 KB (4096 B · Estándar)</option>
                            <option value={16384}>16 KB (16384 B)</option>
                            <option value={32768}>32 KB (32768 B · exFAT)</option>
                            <option value={65536}>64 KB (65536 B · ISO/Vídeo)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Etiqueta del Volumen
                          </label>
                          <input
                            type="text"
                            value={formatLabel}
                            onChange={(e) => setFormatLabel(e.target.value)}
                            placeholder="Ej. Sistema"
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Letra / Punto Montaje
                          </label>
                          <input
                            type="text"
                            value={formatLetter}
                            onChange={(e) => setFormatLetter(e.target.value)}
                            placeholder="C, D, E o /"
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <span className="text-[11px] font-mono text-slate-400">
                          CLI:{' '}
                          <code className="text-sky-300">
                            format fs={formatFs.toLowerCase()} unit={formatCluster}{' '}
                            label=&quot;{formatLabel}&quot; quick
                          </code>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab('clusters')}
                            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-sky-500/50 bg-slate-950 text-xs font-medium text-slate-200 hover:text-sky-300 transition-colors whitespace-nowrap"
                          >
                            Probar Archivos en P{selectedPartition.number}
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                          >
                            Formatear Partición {selectedPartition.number}
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* Shrink / Extend Volume Bar */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <ArrowsUpFromLine className="w-4 h-4 text-sky-400" />
                        <span className="font-semibold text-slate-200">
                          Redimensionar Volumen (SHRINK / EXTEND):
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={100}
                          step={1024}
                          value={resizeAmountMB}
                          onChange={(e) =>
                            setResizeAmountMB(
                              Math.max(100, parseInt(e.target.value, 10) || 1024)
                            )
                          }
                          aria-label="Cantidad en MB para reducir o ampliar"
                          className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-white"
                        />
                        <span className="text-xs font-mono text-slate-400">
                          MB ({formatCapacity(resizeAmountMB).split(' (')[0]})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResizePartition('shrink')}
                          className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/50 text-xs font-mono text-amber-200 transition-colors whitespace-nowrap"
                        >
                          Reducir (SHRINK)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResizePartition('extend')}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-950/50 text-xs font-mono text-emerald-200 transition-colors whitespace-nowrap"
                        >
                          Extender (EXTEND)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right 5 Cols: Active Didactic Challenge Live Checklist */}
              <div
                data-tour="challenge-tracker"
                className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <div className="text-[11px] font-mono text-sky-400 font-semibold">
                      EVALUACIÓN DIDÁCTICA EN VIVO
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      Reto {activeChallenge.number}: {activeChallenge.title}
                    </h3>
                  </div>
                  <select
                    value={activeChallengeId}
                    onChange={(e) => setActiveChallengeId(e.target.value)}
                    aria-label="Seleccionar reto práctico"
                    className="w-full sm:w-auto max-w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
                  >
                    {CHALLENGE_SCENARIOS.map((c) => (
                      <option key={c.id} value={c.id}>
                        Reto {c.number}: {c.title.slice(0, 28)}...
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeChallenge.description}
                </p>

                <div className="space-y-1.5">
                  {activeChallengeReqs.map((req) => (
                    <div
                      key={req.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
                        req.passed
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            req.passed ? 'text-emerald-400' : 'text-slate-600'
                          }`}
                        />
                        <span>{req.label}</span>
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 ${
                          req.passed ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {req.passed ? 'OK' : 'PENDIENTE'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Synchronized DiskPart Console Terminal */}
            <div data-tour="console-terminal">
              <ConsoleTerminal
                entries={terminalEntries}
                activeDisk={activeDisk}
                selectedPartition={selectedPartition}
                onExecuteCommand={(cmd) => runCommandAndSync(cmd, 'cli')}
                onClearHistory={() => setTerminalEntries([])}
              />
            </div>

            {/* Low-Level Sector 0 / GPT Hex Inspector + Boot POST Emulator */}
            <SectorHexAndBootInspector
              disk={activeDisk}
              firmware={firmware}
              bootDiagnostic={bootDiagnostic}
            />
          </div>
        )}

        {/* TAB 2: SECTOR 0 HEX & BOOT POST SIMULATOR */}
        {activeTab === 'hex-boot' && (
          <SectorHexAndBootInspector
            disk={activeDisk}
            firmware={firmware}
            bootDiagnostic={bootDiagnostic}
          />
        )}

        {/* TAB 3: CLUSTER & FILE SIZE SIMULATOR */}
        {activeTab === 'clusters' && (
          <ClusterSimulator
            activeDisk={activeDisk}
            selectedPartition={selectedPartition}
            onSelectPartition={(id) => handleSelectPartition(id)}
            onAddFileToPartition={handleAddFileToPartition}
            onRemoveFileFromPartition={handleRemoveFileFromPartition}
          />
        )}

        {/* TAB 4: PRACTICAL CHALLENGES */}
        {activeTab === 'challenges' && (
          <ChallengesPanel
            disks={disks}
            firmware={firmware}
            activeChallengeId={activeChallengeId}
            onSelectChallenge={setActiveChallengeId}
            onLoadChallengeWorkspace={(
              challengeId,
              targetDiskId,
              recommendedFirmware
            ) => {
              setActiveChallengeId(challengeId);
              setSelectedDiskId(targetDiskId);
              const targetDisk = disks.find((d) => d.id === targetDiskId);
              setSelectedPartitionId(targetDisk?.partitions[0]?.id || null);
              setFirmware(recommendedFirmware);
              setActiveTab('workspace');
            }}
          />
        )}

        {/* TAB 5: TECHNICAL REFERENCE GUIDE */}
        {activeTab === 'guide' && <ReferenceGuide />}
      </main>

      {/* Create Partition Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Crear Nueva Partición en {activeDisk.name} ({activeDisk.partitionTable})
                </h3>
                <p className="text-xs text-slate-400">
                  Espacio libre direccionable: {formatCapacity(diskSpace.unallocatedAddressableMB)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200 whitespace-pre-wrap">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreatePartitionSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Partición
                  </label>
                  <select
                    value={newPartRole}
                    onChange={(e) => {
                      const role = e.target.value as PartitionRole;
                      setNewPartRole(role);
                      if (role === 'efi') {
                        setNewPartFs('FAT32');
                        setNewPartSizeMB(300);
                        setNewPartLabel('EFI-SYSTEM');
                      } else if (role === 'msr') {
                        setNewPartFs('RAW');
                        setNewPartSizeMB(16);
                        setNewPartLabel('MSR-Reservado');
                      } else if (role === 'extended') {
                        setNewPartFs('RAW');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="primary">Primaria (Primary)</option>
                    {activeDisk.partitionTable === 'GPT' && (
                      <>
                        <option value="efi">Sistema EFI (ESP · Arranque UEFI)</option>
                        <option value="msr">Microsoft Reserved (MSR · 16 MB)</option>
                      </>
                    )}
                    {activeDisk.partitionTable === 'MBR' && (
                      <>
                        <option value="extended">Extendida (Contenedor MBR)</option>
                        <option value="logical">Unidad Lógica (Dentro de Extendida)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tamaño en MB ({formatCapacity(newPartSizeMB).split(' (')[0]})
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={
                      newPartRole === 'logical'
                        ? diskSpace.extendedFreeMB
                        : diskSpace.unallocatedAddressableMB
                    }
                    value={newPartSizeMB}
                    onChange={(e) =>
                      setNewPartSizeMB(
                        Math.max(1, parseInt(e.target.value, 10) || 0)
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Size Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-400 mr-1">Tamaños rápidos:</span>
                {[
                  { label: '300 MB (EFI)', mb: 300 },
                  { label: '8 GB (Swap)', mb: 8192 },
                  { label: '50 GB', mb: 51200 },
                  { label: '100 GB', mb: 102400 },
                  { label: '200 GB', mb: 204800 },
                  {
                    label: 'Máximo Libre',
                    mb:
                      newPartRole === 'logical'
                        ? diskSpace.extendedFreeMB
                        : diskSpace.unallocatedAddressableMB,
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setNewPartSizeMB(preset.mb)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {newPartRole !== 'extended' && newPartRole !== 'msr' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Sistema de Archivos
                    </label>
                    <select
                      value={newPartFs}
                      onChange={(e) =>
                        setNewPartFs(e.target.value as FileSystemType)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                    >
                      <option value="NTFS">NTFS</option>
                      <option value="FAT32">FAT32</option>
                      <option value="exFAT">exFAT</option>
                      <option value="ext4">ext4</option>
                      <option value="swap">Linux Swap</option>
                      <option value="RAW">RAW (Sin formatear)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Tamaño de Clúster
                    </label>
                    <select
                      value={newPartCluster}
                      disabled={newPartFs === 'RAW'}
                      onChange={(e) =>
                        setNewPartCluster(
                          parseInt(e.target.value, 10) as ClusterSize
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value={512}>512 B</option>
                      <option value={4096}>4 KB (Estándar)</option>
                      <option value={16384}>16 KB</option>
                      <option value={32768}>32 KB</option>
                      <option value={65536}>64 KB</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Etiqueta
                    </label>
                    <input
                      type="text"
                      value={newPartLabel}
                      onChange={(e) => setNewPartLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white"
                >
                  Crear Partición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clean Educational Footer with Un-deformed Logo & Website Link */}
      <footer className="border-t border-slate-800 bg-slate-950 py-5 px-6 mt-8">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/icono_81a3db5b.png`}
              alt="Logo Un Fantasma en el Sistema"
              referrerPolicy="no-referrer"
              className="h-8 w-auto object-contain shrink-0"
            />
            <span>
              Simulador de Particionado y Sistemas de Archivos · Recurso Educativo Interactivo (MBR/GPT · BIOS/UEFI · NTFS/FAT32/exFAT/ext4/swap)
            </span>
          </div>

          <a
            href="https://www.unfantasmaenelsistema.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-medium transition-colors whitespace-nowrap"
          >
            <span>https://www.unfantasmaenelsistema.com/</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
