import {
  BootDiagnostic,
  ChallengeRequirement,
  ChallengeScenario,
  ClusterSize,
  Disk,
  FAT32_MAX_FILE_BYTES,
  FAT32_MAX_VOLUME_MB,
  FILESYSTEM_SPECS,
  FileSystemType,
  FirmwareType,
  MBR_MAX_ADDRESSABLE_MB,
  NTFS_MFT_RESIDENT_THRESHOLD_BYTES,
  Partition,
  PartitionRole,
  PartitionTableType,
  VirtualFile,
} from '../types/storage';

export function createInitialDisks(): Disk[] {
  return [
    {
      id: 0,
      name: 'Disco 0',
      linuxDev: '/dev/nvme0n1',
      model: 'NVMe SSD Kingston KC3000 500 GB',
      interfaceType: 'NVMe PCIe 4.0',
      totalSizeMB: 512000, // 500 GB
      sectorSize: 512,
      partitionTable: 'GPT',
      partitions: [
        {
          id: 'part-0-1',
          number: 1,
          label: 'EFI-SYSTEM',
          role: 'efi',
          fileSystem: 'FAT32',
          clusterSize: 4096,
          sizeMB: 300,
          offsetMB: 1,
          isActive: false,
          driveLetter: 'S (ESP)',
          files: [
            {
              id: 'init-efi-1',
              name: 'bootmgfw.efi',
              sizeBytes: 1572864,
              count: 1,
              category: 'system',
            },
          ],
        },
        {
          id: 'part-0-2',
          number: 2,
          label: 'MSR-Reservado',
          role: 'msr',
          fileSystem: 'RAW',
          clusterSize: 4096,
          sizeMB: 16,
          offsetMB: 301,
          isActive: false,
          driveLetter: 'MSR',
          files: [],
        },
        {
          id: 'part-0-3',
          number: 3,
          label: 'Sistema-Win11',
          role: 'primary',
          fileSystem: 'NTFS',
          clusterSize: 4096,
          sizeMB: 204800, // 200 GB
          offsetMB: 317,
          isActive: false,
          driveLetter: 'C:',
          files: [
            {
              id: 'init-win-1',
              name: 'pagefile.sys',
              sizeBytes: 8 * 1024 * 1024 * 1024,
              count: 1,
              category: 'system',
            },
          ],
        },
      ],
    },
    {
      id: 1,
      name: 'Disco 1',
      linuxDev: '/dev/sda',
      model: 'Seagate IronWolf Pro 4 TB NAS',
      interfaceType: 'SATA III 6Gb/s',
      totalSizeMB: 4194304, // 4 TB (4096 GB) -> Demonstrates 2 TB MBR barrier!
      sectorSize: 512,
      partitionTable: 'MBR',
      partitions: [
        {
          id: 'part-1-1',
          number: 1,
          label: 'Almacen-Legacy',
          role: 'primary',
          fileSystem: 'NTFS',
          clusterSize: 4096,
          sizeMB: 1048576, // 1 TB
          offsetMB: 1,
          isActive: true,
          driveLetter: 'D:',
          files: [],
        },
      ],
    },
    {
      id: 2,
      name: 'Disco 2',
      linuxDev: '/dev/sdb',
      model: 'SanDisk Ultra Flair USB 32 GB',
      interfaceType: 'USB 3.2 Gen 1',
      totalSizeMB: 32768, // 32 GB
      sectorSize: 512,
      partitionTable: 'MBR',
      partitions: [
        {
          id: 'part-2-1',
          number: 1,
          label: 'USB-DATOS',
          role: 'primary',
          fileSystem: 'FAT32',
          clusterSize: 16384,
          sizeMB: 32760,
          offsetMB: 1,
          isActive: false,
          driveLetter: 'E:',
          files: [],
        },
      ],
    },
  ];
}

export function formatCapacity(sizeMB: number): string {
  if (sizeMB >= 1048576) {
    const tb = sizeMB / 1048576;
    return `${tb.toFixed(2)} TB (${Math.round(sizeMB / 1024).toLocaleString('es-ES')} GB)`;
  }
  if (sizeMB >= 1024) {
    const gb = sizeMB / 1024;
    return `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB (${sizeMB.toLocaleString('es-ES')} MB)`;
  }
  return `${sizeMB.toLocaleString('es-ES')} MB`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes.toLocaleString('es-ES')} B`;
}

export interface DiskSpaceAccounting {
  totalMB: number;
  addressableMB: number;
  mbrLockedOver2TBMB: number;
  allocatedTopLevelMB: number;
  unallocatedAddressableMB: number;
  hasExtendedPartition: boolean;
  extendedSizeMB: number;
  logicalAllocatedMB: number;
  extendedFreeMB: number;
}

export function calculateDiskSpace(disk: Disk): DiskSpaceAccounting {
  const isMbrOver2TB =
    disk.partitionTable === 'MBR' && disk.totalSizeMB > MBR_MAX_ADDRESSABLE_MB;
  const addressableMB = isMbrOver2TB ? MBR_MAX_ADDRESSABLE_MB : disk.totalSizeMB;
  const mbrLockedOver2TBMB = isMbrOver2TB
    ? disk.totalSizeMB - MBR_MAX_ADDRESSABLE_MB
    : 0;

  const topLevelPartitions = disk.partitions.filter((p) => p.role !== 'logical');
  const allocatedTopLevelMB = topLevelPartitions.reduce((acc, p) => acc + p.sizeMB, 0);
  const unallocatedAddressableMB = Math.max(0, addressableMB - allocatedTopLevelMB);

  const extendedPart = disk.partitions.find((p) => p.role === 'extended');
  const logicalParts = disk.partitions.filter((p) => p.role === 'logical');
  const extendedSizeMB = extendedPart ? extendedPart.sizeMB : 0;
  const logicalAllocatedMB = logicalParts.reduce((acc, p) => acc + p.sizeMB, 0);
  const extendedFreeMB = Math.max(0, extendedSizeMB - logicalAllocatedMB);

  return {
    totalMB: disk.totalSizeMB,
    addressableMB,
    mbrLockedOver2TBMB,
    allocatedTopLevelMB,
    unallocatedAddressableMB,
    hasExtendedPartition: Boolean(extendedPart),
    extendedSizeMB,
    logicalAllocatedMB,
    extendedFreeMB,
  };
}

export interface FileAllocationMetrics {
  logicalSizeBytes: number;
  clustersPerFile: number;
  totalClustersOccupied: number;
  physicalSizeOnDiskBytes: number;
  slackSpaceBytes: number;
  efficiencyPercent: number;
  isMftResident: boolean;
}

export function calculateFileAllocation(
  fileSizeBytes: number,
  fileCount: number,
  clusterSize: ClusterSize,
  fileSystem?: FileSystemType,
  enableMftResidency = false
): FileAllocationMetrics {
  const logicalSizeBytes = fileSizeBytes * fileCount;
  const isMftResident =
    enableMftResidency &&
    fileSystem === 'NTFS' &&
    fileSizeBytes > 0 &&
    fileSizeBytes <= NTFS_MFT_RESIDENT_THRESHOLD_BYTES;

  if (isMftResident) {
    return {
      logicalSizeBytes,
      clustersPerFile: 0,
      totalClustersOccupied: 0,
      physicalSizeOnDiskBytes: logicalSizeBytes, // Stored directly inside the MFT 1KB record attribute
      slackSpaceBytes: 0,
      efficiencyPercent: 100,
      isMftResident: true,
    };
  }

  const clustersPerFile =
    fileSizeBytes === 0 ? 0 : Math.max(1, Math.ceil(fileSizeBytes / clusterSize));
  const totalClustersOccupied = clustersPerFile * fileCount;
  const physicalSizeOnDiskBytes = totalClustersOccupied * clusterSize;
  const slackSpaceBytes = Math.max(0, physicalSizeOnDiskBytes - logicalSizeBytes);
  const efficiencyPercent =
    physicalSizeOnDiskBytes > 0
      ? (logicalSizeBytes / physicalSizeOnDiskBytes) * 100
      : 100;

  return {
    logicalSizeBytes,
    clustersPerFile,
    totalClustersOccupied,
    physicalSizeOnDiskBytes,
    slackSpaceBytes,
    efficiencyPercent,
    isMftResident: false,
  };
}

export interface PartitionUsageSummary {
  capacityBytes: number;
  metadataOverheadBytes: number;
  logicalUsedBytes: number;
  physicalUsedBytes: number;
  slackTotalBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export function calculatePartitionUsage(partition: Partition): PartitionUsageSummary {
  const capacityBytes = partition.sizeMB * 1024 * 1024;
  if (
    partition.fileSystem === 'RAW' ||
    partition.role === 'extended' ||
    partition.role === 'msr'
  ) {
    return {
      capacityBytes,
      metadataOverheadBytes: 0,
      logicalUsedBytes: 0,
      physicalUsedBytes: 0,
      slackTotalBytes: 0,
      freeBytes: capacityBytes,
      usedPercent: 0,
    };
  }

  const spec = FILESYSTEM_SPECS[partition.fileSystem];
  const metadataOverheadBytes = Math.round(capacityBytes * spec.MetadataOverheadRatio);

  let logicalUsedBytes = 0;
  let physicalFilesBytes = 0;
  let slackTotalBytes = 0;

  for (const f of partition.files) {
    const metrics = calculateFileAllocation(
      f.sizeBytes,
      f.count,
      partition.clusterSize,
      partition.fileSystem,
      true
    );
    logicalUsedBytes += metrics.logicalSizeBytes;
    physicalFilesBytes += metrics.physicalSizeOnDiskBytes;
    slackTotalBytes += metrics.slackSpaceBytes;
  }

  const physicalUsedBytes = metadataOverheadBytes + physicalFilesBytes;
  const freeBytes = Math.max(0, capacityBytes - physicalUsedBytes);
  const usedPercent = Math.min(100, (physicalUsedBytes / capacityBytes) * 100);

  return {
    capacityBytes,
    metadataOverheadBytes,
    logicalUsedBytes,
    physicalUsedBytes,
    slackTotalBytes,
    freeBytes,
    usedPercent,
  };
}

export function evaluateBootDiagnostic(
  disk: Disk,
  firmware: FirmwareType
): BootDiagnostic {
  if (disk.partitionTable === 'RAW') {
    return {
      canBoot: false,
      status: 'error',
      headline: 'Disco sin inicializar (RAW)',
      details: [
        'El disco no posee firma 0x55AA en el Sector 0 (MBR) ni cabecera "EFI PART" en LBA 1 (GPT).',
        'Ningún firmware (BIOS o UEFI) puede localizar cargadores de arranque en un medio RAW.',
      ],
      recommendation:
        firmware === 'UEFI'
          ? 'Inicializa el disco en GPT (convert gpt) y crea una Partición EFI (ESP) en FAT32.'
          : 'Inicializa el disco en MBR (convert mbr), crea una partición primaria y márcala como Activa.',
      simulatedScreenOutput: {
        screenTitle: 'POST Error — Sin firma de arranque (0x55AA ausente)',
        screenType: 'bios-error',
        lines: [
          `Inicializando bus ${disk.interfaceType}... OK`,
          `Leyendo ${disk.name} (${disk.model}) LBA 0...`,
          'ERROR: Firma mágica 0x55AA no encontrada en los bytes 510-511.',
          'Reboot and Select proper Boot device or Insert Boot Media in selected Boot device and press a key_',
        ],
      },
    };
  }

  if (firmware === 'BIOS' && disk.partitionTable === 'MBR') {
    const activePart = disk.partitions.find(
      (p) => p.role === 'primary' && p.isActive
    );
    const hasFormattedOS = disk.partitions.some(
      (p) =>
        (p.role === 'primary' || p.role === 'logical') &&
        (p.fileSystem === 'NTFS' || p.fileSystem === 'ext4')
    );

    if (!activePart) {
      return {
        canBoot: false,
        status: 'warning',
        headline: 'BIOS/Legacy + MBR: Falta partición Primaria Activa (Flag 0x80)',
        details: [
          'El código del Sector 0 (MBR, 440 bytes) inspecciona las 4 entradas de 16 bytes buscando el indicador de arranque 0x80 (Activa).',
          'Actualmente las entradas tienen byte de estado 0x00 (Inactiva).',
        ],
        recommendation:
          'Selecciona la partición primaria de arranque y ejecuta el comando "active" o pulsa "Marcar Activa".',
        simulatedScreenOutput: {
          screenTitle: 'MBR Bootstrap Loader — Error de Tabla de Particiones',
          screenType: 'bios-error',
          lines: [
            'BIOS Legacy INT 13h -> Cargando LBA 0 en 0x0000:0x7C00 (512 bytes)... OK',
            'Firma 0x55AA verificada. Escaneando 4 entradas de 16 bytes (0x1BE - 0x1FD)...',
            'ERROR: Ninguna entrada primaria contiene el byte de estado 0x80 (Active Boot Flag).',
            'Invalid partition table_',
          ],
        },
      };
    }

    if (activePart.fileSystem === 'RAW' || activePart.fileSystem === 'swap') {
      return {
        canBoot: false,
        status: 'warning',
        headline: `La partición Activa (#${activePart.number}) no contiene un VBR válido (${activePart.fileSystem})`,
        details: [
          `La Partición ${activePart.number} tiene el flag Activo (0x80), pero carece de un sistema de archivos de arranque con VBR (Volume Boot Record).`,
        ],
        recommendation: 'Formatea la partición activa en NTFS, FAT32 o ext4.',
        simulatedScreenOutput: {
          screenTitle: 'VBR Jump Error — Missing Operating System',
          screenType: 'bios-error',
          lines: [
            `MBR -> Partición Primaria #${activePart.number} detectada con flag 0x80 (Activa).`,
            `Saltando al sector de inicio LBA de la Partición #${activePart.number}...`,
            'ERROR: Volume Boot Record (VBR) sin código ejecutable o sistema de archivos RAW.',
            'Missing operating system_',
          ],
        },
      };
    }

    return {
      canBoot: hasFormattedOS,
      status: hasFormattedOS ? 'nominal' : 'warning',
      headline: hasFormattedOS
        ? `Secuencia BIOS/Legacy + MBR Válida (Arranque en Partición ${activePart.number})`
        : 'MBR Activo configurado, pero falta volumen principal de Sistema Operativo (NTFS/ext4)',
      details: [
        `BIOS ejecuta el código del Sector 0 (MBR) -> salta al VBR de la Partición ${activePart.number} (${activePart.label || 'Sin etiqueta'}, ${activePart.fileSystem}).`,
        disk.totalSizeMB > MBR_MAX_ADDRESSABLE_MB
          ? `Atención: Al usar MBR con sectores de 512 B (LBA de 32 bits), se desperdician ${formatCapacity(disk.totalSizeMB - MBR_MAX_ADDRESSABLE_MB)} por encima de la barrera de 2 TB.`
          : 'Límite de tabla MBR: Máximo 4 particiones primarias (o 3 primarias + 1 extendida).',
      ],
      simulatedScreenOutput: {
        screenTitle:
          activePart.fileSystem === 'ext4'
            ? 'GRUB Legacy Stage 1.5 / Stage 2 (MBR)'
            : 'Windows Boot Manager (BOOTMGR — Modo Legacy BIOS)',
        screenType:
          activePart.fileSystem === 'ext4' ? 'grub-menu' : 'windows-boot',
        lines: [
          'BIOS INT 13h -> LBA 0 (MBR 440B Bootstrap) cargado en 0x7C00... OK',
          `Entrada #${activePart.number} verificada con Flag 0x80 (Activa). Saltando al VBR (${activePart.fileSystem})... OK`,
          activePart.fileSystem === 'ext4'
            ? 'GRUB loading stage1.5... Cargando /boot/vmlinuz-linux desde inodo ext4... SISTEMA INICIADO.'
            : 'VBR NTFS -> Cargando BOOTMGR y base BCD -> Iniciando winload.exe (Modo BIOS Legacy)... SISTEMA INICIADO.',
        ],
      },
    };
  }

  if (firmware === 'UEFI' && disk.partitionTable === 'GPT') {
    const efiPart = disk.partitions.find((p) => p.role === 'efi');
    const osParts = disk.partitions.filter(
      (p) =>
        p.role === 'primary' &&
        (p.fileSystem === 'NTFS' || p.fileSystem === 'ext4')
    );

    if (!efiPart) {
      return {
        canBoot: false,
        status: 'warning',
        headline: 'UEFI + GPT: Falta la Partición del Sistema EFI (ESP)',
        details: [
          'El firmware UEFI no ejecuta código del Sector 0. Busca una partición con Type GUID C12A7328-F81F-11D2-BA4B-00A0C93EC93B (ESP).',
          'Sin la partición EFI formateada en FAT32, la placa base no puede cargar bootmgfw.efi ni grubx64.efi.',
        ],
        recommendation:
          'Crea una Partición EFI (ESP) de entre 100 MB y 512 MB formateada en FAT32 (create partition efi size=300).',
        simulatedScreenOutput: {
          screenTitle: 'UEFI Interactive Shell v2.2 — No EFI System Partition Found',
          screenType: 'uefi-shell-error',
          lines: [
            'UEFI v2.80 Firmware -> Cabecera GPT "EFI PART" en LBA 1 verificada (CRC32 OK).',
            'Escaneando Array de GUIDs (LBA 2..33) buscando GUID C12A7328-F81F-11D2-BA4B-00A0C93EC93B...',
            'FS0: No encontrado. Ninguna Partición del Sistema EFI (ESP) presente en el disco.',
            'Shell> _',
          ],
        },
      };
    }

    if (efiPart.fileSystem !== 'FAT32') {
      return {
        canBoot: false,
        status: 'error',
        headline: `Partición EFI con formato inválido (${efiPart.fileSystem})`,
        details: [
          'La especificación UEFI exige que la Partición del Sistema EFI (ESP) esté formateada en FAT32 para que el driver nativo de la placa base pueda montarla.',
        ],
        recommendation: 'Formatea la Partición EFI en FAT32 (format fs=fat32 quick).',
        simulatedScreenOutput: {
          screenTitle: 'UEFI Driver Error — Unsupported Filesystem on ESP',
          screenType: 'uefi-shell-error',
          lines: [
            `Partición ESP #${efiPart.number} encontrada (GUID C12A7328-...).`,
            `Intentando montar con protocolo EFI_SIMPLE_FILE_SYSTEM_PROTOCOL (FAT32)...`,
            `FALLO CRÍTICO: El volumen está en formato ${efiPart.fileSystem}. El firmware UEFI solo monta FAT12/16/32 nativamente.`,
          ],
        },
      };
    }

    if (osParts.length === 0) {
      return {
        canBoot: false,
        status: 'warning',
        headline: 'Partición EFI lista, falta volumen raíz del Sistema Operativo',
        details: [
          `La Partición EFI (${efiPart.sizeMB} MB, FAT32) es válida, pero no existe ninguna partición principal formateada en NTFS (Windows) o ext4 (Linux).`,
        ],
        recommendation:
          'Crea una partición primaria y formatéala en NTFS o ext4 para alojar el sistema operativo.',
        simulatedScreenOutput: {
          screenTitle: 'UEFI Boot Manager — Falta Partición Raíz del SO',
          screenType: 'uefi-shell-error',
          lines: [
            `FS0: Partición EFI (${efiPart.sizeMB} MB, FAT32) montada correctamente.`,
            'Cargando \\EFI\\BOOT\\BOOTX64.EFI...',
            'ERROR 0xc000000e: No se encontró una partición de sistema operativo (NTFS o ext4) a la que transferir el control.',
          ],
        },
      };
    }

    const isDualBoot =
      osParts.some((p) => p.fileSystem === 'NTFS') &&
      osParts.some((p) => p.fileSystem === 'ext4');

    return {
      canBoot: true,
      status: 'nominal',
      headline: isDualBoot
        ? 'Arquitectura UEFI + GPT Dual-Boot (Windows NTFS + Linux ext4) Óptima'
        : 'Arquitectura UEFI + GPT Estándar Lista para Arranque',
      details: [
        `UEFI monta la Partición EFI #${efiPart.number} (${efiPart.sizeMB} MB, FAT32) y ejecuta el cargador .efi registrado en NVRAM.`,
        `Soporta hasta 128 particiones primarias sin partición extendida, direccionamiento LBA de 64 bits (>2 TB) y cabeceras GPT redundantes con suma CRC32.`,
      ],
      simulatedScreenOutput: {
        screenTitle: isDualBoot
          ? 'GNU GRUB v2.12 UEFI Dual-Boot (Windows + Linux)'
          : osParts[0].fileSystem === 'ext4'
            ? 'GNU GRUB v2.12 (UEFI x86_64)'
            : 'Windows Boot Manager (winload.efi — Modo UEFI Nativo)',
        screenType:
          isDualBoot || osParts[0].fileSystem === 'ext4'
            ? 'grub-menu'
            : 'windows-boot',
        lines: [
          `UEFI Secure Boot -> LBA 1 GPT Header CRC32 verificada. Montando FS0: (Partición #${efiPart.number}, FAT32)... OK`,
          isDualBoot
            ? 'Ejecutando \\EFI\\ubuntu\\shimx64.efi -> grubx64.efi -> Menú Dual-Boot: [1] GNU/Linux (ext4) | [2] Windows Boot Manager (NTFS)... OK'
            : osParts[0].fileSystem === 'ext4'
              ? 'Ejecutando \\EFI\\linux\\grubx64.efi -> Montando raíz "/" en ext4 -> Kernel iniciado.'
              : 'Ejecutando \\EFI\\Microsoft\\Boot\\bootmgfw.efi -> Cargando C:\\Windows\\System32\\winload.efi -> Windows 11 Iniciado.',
        ],
      },
    };
  }

  if (firmware === 'UEFI' && disk.partitionTable === 'MBR') {
    return {
      canBoot: false,
      status: 'error',
      headline: 'Incompatibilidad nativa: Firmware UEFI puro sobre disco MBR',
      details: [
        'En sistemas Windows modernos, el instalador en modo UEFI rechaza instalar en discos con tabla MBR ("Windows no se puede instalar en este disco. El disco seleccionado tiene el estilo de partición MBR").',
        'Para arrancar desde MBR en una placa UEFI sería necesario activar el módulo de compatibilidad CSM (Legacy BIOS), perdiendo Secure Boot y Fast Boot.',
      ],
      recommendation:
        'Convierte la tabla de particiones a GPT (convert gpt) o cambia el modo de Firmware a BIOS/Legacy (CSM).',
      simulatedScreenOutput: {
        screenTitle: 'Instalador / Gestor UEFI — Error de Estilo de Partición MBR',
        screenType: 'uefi-shell-error',
        lines: [
          'Modo de arranque actual: UEFI Nativo (CSM Desactivado).',
          `Inspeccionando ${disk.name}: Detectada tabla de particiones MBR en LBA 0 (sin cabecera GPT en LBA 1).`,
          'ERROR: "Windows no se puede instalar en este disco. El disco seleccionado tiene el estilo de partición MBR. En sistemas EFI, Windows solo se puede instalar en discos GPT."',
        ],
      },
    };
  }

  // BIOS + GPT
  return {
    canBoot: false,
    status: 'error',
    headline: 'Conflicto de Arranque: Firmware BIOS/Legacy sobre tabla GPT',
    details: [
      'El firmware BIOS tradicional solo sabe ejecutar los primeros 440 bytes del MBR protector y no comprende la tabla de GUIDs de GPT.',
      'Windows no soporta arranque BIOS/Legacy desde un disco GPT (solo Linux con GRUB2 y una partición especial BIOS Boot "ef02" sin formato puede hacerlo).',
    ],
    recommendation:
      'Cambia el firmware de la placa base a UEFI para aprovechar GPT, o convierte el disco a MBR si el hardware solo soporta BIOS Legacy.',
    simulatedScreenOutput: {
      screenTitle: 'BIOS Legacy INT 13h — MBR Protector GPT Detectado (0xEE)',
      screenType: 'bios-error',
      lines: [
        'BIOS Legacy leyendo LBA 0...',
        'Detectada entrada única de tipo 0xEE (GPT Protective MBR) abarcando todo el disco sin flag 0x80.',
        'ERROR: El firmware BIOS de 16 bits no puede interpretar la cabecera GPT en LBA 1. Arranque abortado.',
      ],
    },
  };
}

export interface SectorHexBlock {
  offsetHex: string;
  lengthBytes: number;
  title: string;
  hexBytes: string;
  meaning: string;
  highlightColor: 'sky' | 'emerald' | 'amber' | 'indigo' | 'rose';
}

export function generateSectorHexInspection(disk: Disk): {
  sectorTitle: string;
  sectorSubtitle: string;
  blocks: SectorHexBlock[];
} {
  if (disk.partitionTable === 'RAW') {
    return {
      sectorTitle: 'LBA 0 (Sector 0) — Disco en Bruto (RAW / Sin Inicializar)',
      sectorSubtitle:
        'Los 512 bytes del primer sector están en 0x00. No existe código de arranque ni firma 0x55AA.',
      blocks: [
        {
          offsetHex: '0x000 - 0x1FD',
          lengthBytes: 510,
          title: 'Área Vacía / Sin Inicializar',
          hexBytes: '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...',
          meaning: 'Sin código de arranque ni entradas de partición.',
          highlightColor: 'rose',
        },
        {
          offsetHex: '0x1FE - 0x1FF',
          lengthBytes: 2,
          title: 'Firma de Sector de Arranque Ausente',
          hexBytes: '00 00 (Debería ser 55 AA)',
          meaning:
            'Al no terminar en 0x55AA, la BIOS/UEFI considera el disco como no inicializado.',
          highlightColor: 'rose',
        },
      ],
    };
  }

  if (disk.partitionTable === 'MBR') {
    const topLevel = disk.partitions.filter((p) => p.role !== 'logical').slice(0, 4);
    const entryBlocks: SectorHexBlock[] = [0, 1, 2, 3].map((slotIdx) => {
      const part = topLevel[slotIdx];
      const baseOffset = 0x1be + slotIdx * 16;
      const endOffset = baseOffset + 15;
      const offsetStr = `0x${baseOffset.toString(16).toUpperCase()} - 0x${endOffset
        .toString(16)
        .toUpperCase()}`;

      if (!part) {
        return {
          offsetHex: offsetStr,
          lengthBytes: 16,
          title: `Entrada de Tabla MBR #${slotIdx + 1} (Libre)`,
          hexBytes: '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
          meaning: 'Entrada de 16 bytes disponible para una partición Primaria o Extendida.',
          highlightColor: 'sky',
        };
      }

      const bootByte = part.isActive ? '80' : '00';
      const typeByte =
        part.role === 'extended'
          ? '0F'
          : part.fileSystem === 'FAT32'
            ? '0C'
            : part.fileSystem === 'ext4'
              ? '83'
              : part.fileSystem === 'swap'
                ? '82'
                : '07'; // NTFS / exFAT

      const sectorsCount = Math.min(
        0xffffffff,
        Math.round((part.sizeMB * 1024 * 1024) / disk.sectorSize)
      );
      const countHex = sectorsCount
        .toString(16)
        .toUpperCase()
        .padStart(8, '0')
        .match(/../g)!
        .reverse()
        .join(' ');

      return {
        offsetHex: offsetStr,
        lengthBytes: 16,
        title: `Entrada MBR #${slotIdx + 1}: Partición ${part.number} (${part.role.toUpperCase()})`,
        hexBytes: `${bootByte} 20 21 00 ${typeByte} FE FF FF 00 08 00 00 ${countHex}`,
        meaning: `Flag Arranque: 0x${bootByte} (${
          part.isActive ? 'ACTIVA' : 'Inactiva'
        }) · Tipo ID: 0x${typeByte} (${
          part.role === 'extended' ? 'Extendida LBA' : part.fileSystem
        }) · Sectores LBA (32-bit LE): ${sectorsCount.toLocaleString('es-ES')} (${formatCapacity(
          part.sizeMB
        ).split(' (')[0]})`,
        highlightColor: part.isActive
          ? 'emerald'
          : part.role === 'extended'
            ? 'indigo'
            : 'amber',
      };
    });

    return {
      sectorTitle: 'Estructura Física del Sector 0 (LBA 0) — Master Boot Record (512 Bytes)',
      sectorSubtitle:
        '440B Código de Arranque + 4B Firma de Disco + 2B Reservados + 64B Tabla de 4 Entradas (4×16B) + 2B Firma Mágica 0x55AA',
      blocks: [
        {
          offsetHex: '0x000 - 0x1B7',
          lengthBytes: 440,
          title: 'Bootstrap Code Area (Código Maestro de Arranque)',
          hexBytes: '33 C0 8E D0 BC 00 7C 8E C0 8E D8 BE 00 7C BF 00 06 B9 00 02 FC F3 A4 ...',
          meaning:
            'Instrucciones máquina x86 (16-bit Real Mode) que escanean la tabla de 64 bytes buscando la partición con el byte 0x80.',
          highlightColor: 'sky',
        },
        {
          offsetHex: '0x1B8 - 0x1BD',
          lengthBytes: 6,
          title: 'Disk Signature (4B) + Reserved (2B)',
          hexBytes: `A4 F2 0${disk.id} 8B 00 00`,
          meaning: `Identificador único de 32 bits del ${disk.name} utilizado por el gestor de arranque para localizar el disco.`,
          highlightColor: 'sky',
        },
        ...entryBlocks,
        {
          offsetHex: '0x1FE - 0x1FF',
          lengthBytes: 2,
          title: 'Magic Boot Signature (Firma de Sector Válido)',
          hexBytes: '55 AA',
          meaning:
            'Bytes 510 y 511 obligatorios (0x55AA). Sin ellos, el firmware rechaza el sector como no arrancable.',
          highlightColor: 'emerald',
        },
      ],
    };
  }

  // GPT Inspection
  return {
    sectorTitle: 'Estructura Física GPT — LBA 0 (Protective MBR) + LBA 1 (GPT Header) + LBA 2..33 (128 GUIDs)',
    sectorSubtitle:
      'Direccionamiento de 64 bits (LBA) con comprobación de integridad CRC32 y copia de respaldo secundaria al final del disco.',
    blocks: [
      {
        offsetHex: 'LBA 0 (512 B)',
        lengthBytes: 512,
        title: 'Protective MBR (MBR Protector contra herramientas antiguas)',
        hexBytes: '00 00 02 00 EE FE FF FF 01 00 00 00 FF FF FF FF ... 55 AA',
        meaning:
          'Contiene 1 partición ficticia de tipo 0xEE que abarca todo el disco para evitar que utilidades fdisk antiguas sobrescriban un disco GPT creyendo que está vacío.',
        highlightColor: 'indigo',
      },
      {
        offsetHex: 'LBA 1 (0x200)',
        lengthBytes: 92,
        title: 'Primary GPT Header (Firma "EFI PART" + CRC32)',
        hexBytes: '45 46 49 20 50 41 52 54 00 00 01 00 5C 00 00 00 [CRC32: 9A 4E 12 C1]',
        meaning:
          'ASCII "EFI PART" (45 46 49 20 50 41 52 54), versión 1.0, punteros LBA de 64 bits al inicio/fin del disco y suma de verificación CRC32.',
        highlightColor: 'emerald',
      },
      ...disk.partitions.slice(0, 4).map((p, idx) => {
        const typeGuid =
          p.role === 'efi'
            ? 'C12A7328-F81F-11D2-BA4B-00A0C93EC93B (EFI System Partition)'
            : p.role === 'msr'
              ? 'E3C9E316-0B5C-4DB8-817D-F92DF00215AE (Microsoft Reserved MSR)'
              : p.fileSystem === 'RAW'
                ? 'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7 (Raw Basic Partition)'
                : FILESYSTEM_SPECS[p.fileSystem].gptGuid;

        return {
          offsetHex: `LBA ${2 + Math.floor(idx / 4)} · Entrada #${p.number}`,
          lengthBytes: 128,
          title: `Entrada GPT #${p.number}: ${p.label || 'Volumen'} (${
            p.role === 'efi' ? 'ESP FAT32' : p.role === 'msr' ? 'MSR' : p.fileSystem
          })`,
          hexBytes: `GUID Tipo: ${typeGuid}`,
          meaning: `Tamaño: ${formatCapacity(p.sizeMB)} · Offset: ${p.offsetMB} MB · Nombre UTF-16LE (72 bytes): "${
            p.label || 'Partition'
          }"`,
          highlightColor:
            p.role === 'efi' ? ('emerald' as const) : ('sky' as const),
        };
      }),
    ],
  };
}

export function validateCreatePartition(
  disk: Disk,
  role: PartitionRole,
  sizeMB: number
): { valid: boolean; error?: string } {
  if (disk.partitionTable === 'RAW') {
    return {
      valid: false,
      error:
        'El disco está sin inicializar (RAW). Primero debes inicializarlo en MBR o GPT (comando: convert mbr / convert gpt).',
    };
  }

  if (sizeMB <= 0 || Number.isNaN(sizeMB)) {
    return {
      valid: false,
      error: 'El tamaño de la partición debe ser mayor a 0 MB.',
    };
  }

  const space = calculateDiskSpace(disk);

  if (disk.partitionTable === 'MBR') {
    if (role === 'efi' || role === 'msr') {
      return {
        valid: false,
        error:
          'Las particiones EFI (ESP) y MSR son exclusivas del esquema de particionado GPT. En un disco MBR debes crear una partición Primaria y marcarla como Activa.',
      };
    }

    const primaryCount = disk.partitions.filter((p) => p.role === 'primary').length;
    const extendedCount = disk.partitions.filter((p) => p.role === 'extended').length;
    const topLevelCount = primaryCount + extendedCount;

    if (role === 'primary') {
      if (topLevelCount >= 4) {
        return {
          valid: false,
          error:
            'Límite clásico de MBR alcanzado: La tabla MBR solo tiene 64 bytes (4 entradas de 16 bytes). No puedes crear más de 4 particiones primarias (o 3 primarias + 1 extendida). Para tener más de 4 volúmenes en MBR, elimina la 4ª primaria, crea 1 Partición Extendida y dentro de ella crea Unidades Lógicas.',
        };
      }
      if (sizeMB > space.unallocatedAddressableMB) {
        return {
          valid: false,
          error:
            space.mbrLockedOver2TBMB > 0
              ? `Espacio direccionable insuficiente (${formatCapacity(space.unallocatedAddressableMB)} libres). Recuerda que MBR no puede direccionar más allá de los primeros 2 TB (2,097,152 MB). Convierte a GPT para usar los 4 TB.`
              : `No hay suficiente espacio no asignado (${formatCapacity(space.unallocatedAddressableMB)} disponibles).`,
        };
      }
    } else if (role === 'extended') {
      if (extendedCount >= 1) {
        return {
          valid: false,
          error:
            'Restricción MBR: Solo puede existir 1 única Partición Extendida por disco. Crea Unidades Lógicas dentro de la Partición Extendida existente.',
        };
      }
      if (topLevelCount >= 4) {
        return {
          valid: false,
          error:
            'Las 4 entradas de la tabla MBR ya están ocupadas por particiones primarias. Elimina al menos una primaria para crear la Partición Extendida.',
        };
      }
      if (sizeMB > space.unallocatedAddressableMB) {
        return {
          valid: false,
          error: `El tamaño solicitado supera el espacio direccionable libre (${formatCapacity(space.unallocatedAddressableMB)}).`,
        };
      }
    } else if (role === 'logical') {
      if (!space.hasExtendedPartition) {
        return {
          valid: false,
          error:
            'No puedes crear una Unidad Lógica sin haber creado antes una Partición Extendida contenedora en MBR.',
        };
      }
      if (sizeMB > space.extendedFreeMB) {
        return {
          valid: false,
          error: `Espacio insuficiente dentro de la Partición Extendida. Disponible dentro de la extendida: ${formatCapacity(space.extendedFreeMB)}.`,
        };
      }
    }
  } else if (disk.partitionTable === 'GPT') {
    if (role === 'extended' || role === 'logical') {
      return {
        valid: false,
        error:
          'En una tabla GPT no existen las particiones Extendidas ni Lógicas. GPT soporta hasta 128 particiones Primarias de forma nativa.',
      };
    }

    if (disk.partitions.length >= 128) {
      return {
        valid: false,
        error: 'Se ha alcanzado el límite de 128 entradas de la tabla GPT estándar.',
      };
    }

    if (sizeMB > space.unallocatedAddressableMB) {
      return {
        valid: false,
        error: `Espacio libre insuficiente en el disco (${formatCapacity(space.unallocatedAddressableMB)} disponibles).`,
      };
    }
  }

  return { valid: true };
}

export function validateFormatPartition(
  partition: Partition,
  fileSystem: Exclude<FileSystemType, 'RAW'>,
  clusterSize: ClusterSize
): { valid: boolean; warning?: string; error?: string } {
  if (partition.role === 'extended') {
    return {
      valid: false,
      error:
        'Una Partición Extendida es un contenedor lógico (EBR) y no se puede formatear directamente. Debes crear y formatear Unidades Lógicas en su interior.',
    };
  }

  if (partition.role === 'msr') {
    return {
      valid: false,
      error:
        'La Partición Reservada de Microsoft (MSR, 16 MB) no lleva sistema de archivos (debe permanecer sin formato RAW).',
    };
  }

  if (fileSystem === 'FAT32') {
    if (partition.sizeMB > FAT32_MAX_VOLUME_MB) {
      return {
        valid: false,
        error: `FAT32 no soporta volúmenes mayores a 2 TB (${formatCapacity(FAT32_MAX_VOLUME_MB)}). Usa NTFS, exFAT o ext4.`,
      };
    }
    if (partition.sizeMB > 32768) {
      return {
        valid: true,
        warning:
          'Nota técnica: La herramienta nativa de Windows (DiskPart / Administración de discos) bloquea artificialmente el formateo FAT32 en volúmenes mayores a 32 GB (error: "El volumen es demasiado grande para FAT32"), aunque utilidades como GParted o Rufus permiten formatear en FAT32 hasta 2 TB.',
      };
    }
  }

  if (partition.role === 'efi' && fileSystem !== 'FAT32') {
    return {
      valid: true,
      warning:
        'Advertencia crítica: Has formateado una Partición EFI (ESP) en un sistema distinto de FAT32. El firmware UEFI estándar exige FAT32 para poder leer los binarios de arranque (.efi).',
    };
  }

  const maxVolMB = FILESYSTEM_SPECS[fileSystem].maxVolumeSizeMB;
  if (partition.sizeMB > maxVolMB) {
    return {
      valid: false,
      error: `El volumen (${formatCapacity(partition.sizeMB)}) excede el tamaño máximo de volumen soportado por ${fileSystem}.`,
    };
  }

  if (clusterSize > 65536) {
    return {
      valid: false,
      error: 'Tamaño de clúster no válido.',
    };
  }

  return { valid: true };
}

export function validateAddFileToPartition(
  partition: Partition,
  file: VirtualFile
): { valid: boolean; error?: string } {
  if (partition.role === 'extended' || partition.role === 'msr') {
    return {
      valid: false,
      error:
        'No se pueden guardar archivos directamente en una Partición Extendida contenedora ni en una partición MSR.',
    };
  }

  if (partition.fileSystem === 'RAW') {
    return {
      valid: false,
      error:
        'La partición está en formato RAW (sin sistema de archivos). Formatéala en NTFS, FAT32, exFAT o ext4 antes de almacenar archivos.',
    };
  }

  if (partition.fileSystem === 'swap') {
    return {
      valid: false,
      error:
        'Una partición Linux Swap es un área de intercambio de páginas de memoria RAM del kernel y no posee directorio para almacenar archivos de usuario.',
    };
  }

  if (
    partition.fileSystem === 'FAT32' &&
    file.sizeBytes > FAT32_MAX_FILE_BYTES
  ) {
    return {
      valid: false,
      error: `LÍMITE DE TAMAÑO DE ARCHIVO EN FAT32 SUPERADO: El archivo "${file.name}" mide ${formatBytes(file.sizeBytes)}, pero FAT32 utiliza un campo de 32 bits para registrar el tamaño en bytes, lo que impone un límite estricto de 4 GB menos 1 byte (4,294,967,295 B). Aunque la partición tenga espacio libre suficiente, debes formatearla en NTFS, exFAT o ext4 para almacenar archivos individuales >= 4 GB.`,
    };
  }

  const spec = FILESYSTEM_SPECS[partition.fileSystem];
  if (file.sizeBytes > spec.maxFileSizeBytes) {
    return {
      valid: false,
      error: `El archivo "${file.name}" (${formatBytes(file.sizeBytes)}) supera el tamaño máximo de archivo individual en ${partition.fileSystem} (${spec.maxFileSizeLabel}).`,
    };
  }

  const usage = calculatePartitionUsage(partition);
  const allocation = calculateFileAllocation(
    file.sizeBytes,
    file.count,
    partition.clusterSize,
    partition.fileSystem,
    true
  );

  if (allocation.physicalSizeOnDiskBytes > usage.freeBytes) {
    return {
      valid: false,
      error: `Espacio en disco insuficiente debido al consumo de clústeres: El archivo requiere ${formatBytes(allocation.physicalSizeOnDiskBytes)} en disco (${allocation.totalClustersOccupied.toLocaleString('es-ES')} clústeres de ${partition.clusterSize / 1024 >= 1 ? `${partition.clusterSize / 1024} KB` : `${partition.clusterSize} B`}, incluyendo ${formatBytes(allocation.slackSpaceBytes)} de Slack Space), pero solo quedan ${formatBytes(usage.freeBytes)} libres.`,
    };
  }

  return { valid: true };
}

export function renumberPartitions(partitions: Partition[]): Partition[] {
  let runningOffset = 1;
  return partitions.map((p, idx) => {
    const updated = {
      ...p,
      number: idx + 1,
      offsetMB: runningOffset,
    };
    if (p.role !== 'logical') {
      runningOffset += p.sizeMB;
    }
    return updated;
  });
}

export const CHALLENGE_SCENARIOS: ChallengeScenario[] = [
  {
    id: 'reto-1-uefi-gpt',
    number: '01',
    title: 'Instalación Estándar Windows 11 en Arquitectura UEFI + GPT',
    subtitle: 'Partición EFI (ESP) en FAT32 + MSR (16 MB) + Volumen de Sistema en NTFS (C:)',
    difficulty: 'Básico',
    description:
      'Configura el Disco 0 (SSD NVMe 500 GB) para un arranque moderno UEFI. Debe tener tabla de particiones GPT, una Partición del Sistema EFI (ESP) formateada en FAT32 (100–512 MB) y una partición Primaria en NTFS de al menos 100 GB con la letra C:.',
    targetDiskId: 0,
    recommendedFirmware: 'UEFI',
    hintCommand:
      'select disk 0 -> clean -> convert gpt -> create partition efi size=300 -> format fs=fat32 quick -> create partition msr size=16 -> create partition primary size=204800 -> format fs=ntfs label="Windows11" quick -> assign letter=C',
    linuxHintCommand:
      'parted /dev/nvme0n1 mklabel gpt && parted /dev/nvme0n1 mkpart ESP fat32 1MiB 301MiB && mkfs.fat -F 32 /dev/nvme0n1p1 && mkfs.ntfs -L Windows11 /dev/nvme0n1p3',
    learningGoal:
      'Comprender por qué UEFI requiere una tabla GPT y una partición especial FAT32 (ESP) para leer cargadores .efi.',
  },
  {
    id: 'reto-2-mbr-extended',
    number: '02',
    title: 'Superando el Límite de las 4 Primarias en MBR (EBR + Lógicas)',
    subtitle: 'BIOS/Legacy + 3 Primarias (1 Activa) + 1 Extendida con 2 Unidades Lógicas',
    difficulty: 'Intermedio',
    description:
      'En el Disco 0 bajo firmware BIOS/Legacy y tabla MBR, el cliente necesita 5 volúmenes operativos. Como MBR solo admite 4 entradas en su tabla de 64 bytes, crea 3 particiones Primarias (marca la primera como Activa y formatéala en NTFS), 1 Partición Extendida y al menos 2 Unidades Lógicas formateadas dentro de ella.',
    targetDiskId: 0,
    recommendedFirmware: 'BIOS',
    hintCommand:
      'select disk 0 -> clean -> convert mbr -> create partition primary size=51200 -> format fs=ntfs quick -> active -> create partition primary size=51200 -> create partition primary size=51200 -> create partition extended size=204800 -> create partition logical size=81920 -> format fs=ntfs quick -> create partition logical size=81920 -> format fs=fat32 quick',
    linuxHintCommand:
      'parted /dev/nvme0n1 mklabel msdos && fdisk /dev/nvme0n1 (crear p1..p3 primarias, p4 extendida 0x0F y lógicas p5, p6)',
    learningGoal:
      'Dominar la estructura de 64 bytes del MBR, el flag de arranque Activo (0x80) y los contenedores EBR (Partición Extendida + Unidades Lógicas).',
  },
  {
    id: 'reto-3-barrera-2tb',
    number: '03',
    title: 'Rompiendo la Barrera de los 2 TB en Discos de Gran Capacidad',
    subtitle: 'Migración de MBR (LBA 32-bit) a GPT (LBA 64-bit) en el HDD de 4 TB',
    difficulty: 'Básico',
    description:
      'El Disco 1 (HDD SATA de 4 TB) está inicializado en MBR, lo que bloquea los últimos 2 TB debido al límite de direccionamiento de 32 bits (2^32 sectores x 512 bytes = 2 TB). Limpia y convierte el Disco 1 a GPT y crea una partición Primaria de más de 2.5 TB (> 2,621,440 MB) formateada en NTFS o ext4.',
    targetDiskId: 1,
    recommendedFirmware: 'UEFI',
    hintCommand:
      'select disk 1 -> clean -> convert gpt -> create partition primary size=3145728 -> format fs=ntfs label="Masivo4TB" quick',
    linuxHintCommand:
      'parted /dev/sda mklabel gpt && parted /dev/sda mkpart primary ext4 1MiB 100% && mkfs.ext4 /dev/sda1',
    learningGoal:
      'Experimentar visualmente el límite matemático de 2 TB del esquema MBR y desbloquear toda la capacidad mediante direccionamiento LBA de 64 bits en GPT.',
  },
  {
    id: 'reto-4-fat32-4gb-limit',
    number: '04',
    title: 'El Error de los 4 GB en FAT32 y Optimización con exFAT / NTFS 64 KB',
    subtitle: 'Almacenar una imagen ISO de 4.7 GB en el Pendrive USB de 32 GB',
    difficulty: 'Intermedio',
    description:
      'El Disco 2 (Pendrive USB 32 GB) viene formateado en FAT32, por lo que rechaza guardar el archivo "ubuntu_24_04_desktop_amd64.iso" (4.70 GB) debido al límite de 2^32 - 1 bytes por archivo. Formatea la partición del Disco 2 en exFAT o NTFS con un tamaño de clúster de 64 KB (65536 B, óptimo para grandes archivos multimedia/ISO) e inserta el archivo ISO de 4.7 GB.',
    targetDiskId: 2,
    recommendedFirmware: 'UEFI',
    hintCommand:
      'select disk 2 -> select partition 1 -> format fs=exfat unit=65536 label="USB-ISO" quick (y luego añade el archivo ISO de 4.7 GB en el Simulador de Clústeres)',
    linuxHintCommand:
      'mkfs.exfat -c 64K -L "USB-ISO" /dev/sdb1',
    learningGoal:
      'Diferenciar la capacidad libre del volumen frente al límite de tamaño de archivo individual de FAT32 (4 GB - 1 B) y emplear exFAT/NTFS con clúster de 64 KB.',
  },
  {
    id: 'reto-5-dual-boot-linux-win',
    number: '05',
    title: 'Estación Dual-Boot Completa: Windows (NTFS) + GNU/Linux (ext4 + swap)',
    subtitle: 'Reducción de volumen (SHRINK) + Partición Raíz ext4 + Área de Intercambio Swap',
    difficulty: 'Avanzado',
    description:
      'Diseña en el Disco 0 (500 GB) bajo UEFI y tabla GPT un esquema Dual-Boot completo que contenga: 1 Partición EFI (ESP) en FAT32, 1 partición Primaria en NTFS para Windows, 1 partición Primaria en ext4 (bloque de 4 KB) para GNU/Linux y 1 partición de intercambio Linux Swap de al menos 4 GB (4096 MB).',
    targetDiskId: 0,
    recommendedFirmware: 'UEFI',
    hintCommand:
      'select disk 0 -> create partition primary size=150000 -> format fs=ext4 unit=4096 label="LinuxRoot" quick -> create partition primary size=8192 -> format fs=swap label="LinuxSwap" quick',
    linuxHintCommand:
      'mkfs.ext4 -b 4096 -L LinuxRoot /dev/nvme0n1p4 && mkswap -L LinuxSwap /dev/nvme0n1p5',
    learningGoal:
      'Integrar sistemas de archivos Windows (NTFS) y GNU/Linux (ext4 + área de paginación swap) compartiendo una única partición de arranque EFI FAT32.',
  },
];

export function evaluateChallenge(
  scenarioId: string,
  disks: Disk[],
  firmware: FirmwareType
): ChallengeRequirement[] {
  const disk0 = disks.find((d) => d.id === 0)!;
  const disk1 = disks.find((d) => d.id === 1)!;
  const disk2 = disks.find((d) => d.id === 2)!;

  switch (scenarioId) {
    case 'reto-1-uefi-gpt': {
      const hasEfiFat32 = disk0.partitions.some(
        (p) =>
          p.role === 'efi' &&
          p.fileSystem === 'FAT32' &&
          p.sizeMB >= 100 &&
          p.sizeMB <= 1024
      );
      const hasNtfsC = disk0.partitions.some(
        (p) =>
          p.role === 'primary' &&
          p.fileSystem === 'NTFS' &&
          p.sizeMB >= 102400 &&
          (p.driveLetter?.toUpperCase().startsWith('C') ?? false)
      );
      return [
        {
          id: 'r1-fw',
          label: 'Modo de Firmware configurado en UEFI',
          passed: firmware === 'UEFI',
        },
        {
          id: 'r1-gpt',
          label: 'Disco 0 inicializado con tabla de particiones GPT',
          passed: disk0.partitionTable === 'GPT',
        },
        {
          id: 'r1-esp',
          label: 'Partición del Sistema EFI (ESP) creada (100–1024 MB) y formateada en FAT32',
          passed: hasEfiFat32,
        },
        {
          id: 'r1-ntfs',
          label: 'Partición Primaria de sistema (>= 100 GB) formateada en NTFS con letra C:',
          passed: hasNtfsC,
        },
      ];
    }

    case 'reto-2-mbr-extended': {
      const primaries = disk0.partitions.filter((p) => p.role === 'primary');
      const hasActiveFormattedPrimary = primaries.some(
        (p) => p.isActive && p.fileSystem !== 'RAW'
      );
      const hasExtended = disk0.partitions.some((p) => p.role === 'extended');
      const formattedLogicals = disk0.partitions.filter(
        (p) => p.role === 'logical' && p.fileSystem !== 'RAW'
      );
      return [
        {
          id: 'r2-fw',
          label: 'Firmware en BIOS/Legacy y Disco 0 con tabla MBR',
          passed: firmware === 'BIOS' && disk0.partitionTable === 'MBR',
        },
        {
          id: 'r2-prim',
          label: '3 Particiones Primarias creadas (con 1 marcada como Activa y formateada)',
          passed: primaries.length === 3 && hasActiveFormattedPrimary,
        },
        {
          id: 'r2-ext',
          label: '1 Partición Extendida contenedora creada en la 4ª entrada MBR',
          passed: hasExtended,
        },
        {
          id: 'r2-log',
          label: 'Al menos 2 Unidades Lógicas creadas y formateadas dentro de la Extendida',
          passed: formattedLogicals.length >= 2,
        },
      ];
    }

    case 'reto-3-barrera-2tb': {
      const largePart = disk1.partitions.find(
        (p) =>
          p.role === 'primary' &&
          p.sizeMB >= 2621440 && // >= 2.5 TB
          (p.fileSystem === 'NTFS' ||
            p.fileSystem === 'ext4' ||
            p.fileSystem === 'exFAT')
      );
      return [
        {
          id: 'r3-gpt',
          label: 'Disco 1 (HDD 4 TB) convertido a tabla de particiones GPT',
          passed: disk1.partitionTable === 'GPT',
        },
        {
          id: 'r3-size',
          label: 'Partición Primaria creada con capacidad superior a 2.5 TB (> 2,621,440 MB)',
          passed: Boolean(largePart),
        },
        {
          id: 'r3-fs',
          label: 'Volumen de gran capacidad formateado en NTFS, exFAT o ext4',
          passed: Boolean(largePart),
        },
      ];
    }

    case 'reto-4-fat32-4gb-limit': {
      const usbPart = disk2.partitions.find(
        (p) =>
          (p.fileSystem === 'NTFS' ||
            p.fileSystem === 'exFAT' ||
            p.fileSystem === 'ext4') &&
          p.clusterSize === 65536
      );
      const hasIsoFile = disk2.partitions.some((p) =>
        p.files.some((f) => f.sizeBytes > FAT32_MAX_FILE_BYTES)
      );
      return [
        {
          id: 'r4-fs',
          label: 'Partición del Disco 2 (USB 32 GB) formateada en exFAT, NTFS o ext4',
          passed: disk2.partitions.some(
            (p) =>
              p.fileSystem === 'NTFS' ||
              p.fileSystem === 'exFAT' ||
              p.fileSystem === 'ext4'
          ),
        },
        {
          id: 'r4-cluster',
          label: 'Tamaño de clúster/unidad de asignación configurado en 64 KB (65536 B)',
          passed: Boolean(usbPart),
        },
        {
          id: 'r4-iso',
          label: 'Archivo ISO de más de 4 GB (ubuntu_24_04_desktop_amd64.iso de 4.7 GB) almacenado en el USB',
          passed: hasIsoFile,
        },
      ];
    }

    case 'reto-5-dual-boot-linux-win': {
      const hasEsp = disk0.partitions.some(
        (p) => p.role === 'efi' && p.fileSystem === 'FAT32'
      );
      const hasWinNtfs = disk0.partitions.some(
        (p) => p.role === 'primary' && p.fileSystem === 'NTFS'
      );
      const hasLinuxExt4 = disk0.partitions.some(
        (p) =>
          p.role === 'primary' &&
          p.fileSystem === 'ext4' &&
          p.clusterSize === 4096
      );
      const hasLinuxSwap = disk0.partitions.some(
        (p) => p.fileSystem === 'swap' && p.sizeMB >= 4096
      );
      return [
        {
          id: 'r5-gpt',
          label: 'Sistema en modo UEFI con Disco 0 en tabla GPT y Partición EFI FAT32',
          passed: firmware === 'UEFI' && disk0.partitionTable === 'GPT' && hasEsp,
        },
        {
          id: 'r5-win',
          label: 'Volumen Primario Windows formateado en NTFS',
          passed: hasWinNtfs,
        },
        {
          id: 'r5-lin',
          label: 'Volumen Primario GNU/Linux formateado en ext4 con bloque de 4 KB',
          passed: hasLinuxExt4,
        },
        {
          id: 'r5-swap',
          label: 'Partición de área de intercambio Linux Swap creada (>= 4 GB / 4096 MB)',
          passed: hasLinuxSwap,
        },
      ];
    }

    default:
      return [];
  }
}

export interface DiskpartExecutionResult {
  disks: Disk[];
  selectedDiskId: number;
  selectedPartitionId: string | null;
  output: string;
  linuxEquivalent?: string;
  status: 'info' | 'success' | 'warning' | 'error';
  clearScreen?: boolean;
}

export function executeDiskpartCommand(
  rawInput: string,
  disks: Disk[],
  selectedDiskId: number,
  selectedPartitionId: string | null
): DiskpartExecutionResult {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const currentDisk = disks.find((d) => d.id === selectedDiskId) || disks[0];
  const currentPart =
    currentDisk.partitions.find((p) => p.id === selectedPartitionId) || null;

  const getPartLinuxDev = (disk: Disk, partNumber: number) =>
    disk.linuxDev.includes('nvme')
      ? `${disk.linuxDev}p${partNumber}`
      : `${disk.linuxDev}${partNumber}`;

  if (!input) {
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      output: '',
      status: 'info',
    };
  }

  if (lower === 'cls' || lower === 'clear') {
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      output: '',
      status: 'info',
      clearScreen: true,
    };
  }

  if (lower === 'help' || lower === '?') {
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      status: 'info',
      output: [
        'Comandos de Microsoft DiskPart y Utilidades GNU/Linux soportados en el simulador:',
        '  LIST DISK / fdisk -l           - Muestra todos los discos físicos conectados y su estilo (MBR/GPT).',
        '  SELECT DISK <0|1|2>            - Selecciona el disco de trabajo activo.',
        '  DETAIL DISK                    - Muestra la geometría, sectores LBA y espacio direccionable.',
        '  CLEAN / wipefs -a              - Elimina todas las particiones y deja el disco sin inicializar (RAW).',
        '  CONVERT MBR                    - Inicializa o convierte un disco vacío al esquema MBR (32-bit LBA).',
        '  CONVERT GPT                    - Inicializa o convierte un disco vacío al esquema GPT (64-bit LBA).',
        '  LIST PARTITION / lsblk         - Lista las particiones del disco seleccionado.',
        '  SELECT PARTITION <N>           - Selecciona la partición número N en el disco actual.',
        '  DETAIL PARTITION               - Muestra GUID/ID hexadecimal, offset LBA, clúster y consumo.',
        '  FILESYSTEMS                    - Muestra los sistemas de archivos soportados y tamaños de clúster.',
        '  CREATE PARTITION PRIMARY [SIZE=<MB>]  - Crea una partición primaria (en MBR o GPT).',
        '  CREATE PARTITION EFI [SIZE=<MB>]      - Crea una Partición del Sistema EFI (ESP) en discos GPT.',
        '  CREATE PARTITION MSR [SIZE=<MB>]      - Crea una Partición Reservada de Microsoft (MSR, 16MB) en GPT.',
        '  CREATE PARTITION EXTENDED [SIZE=<MB>] - Crea una Partición Extendida contenedora en discos MBR.',
        '  CREATE PARTITION LOGICAL [SIZE=<MB>]  - Crea una Unidad Lógica dentro de la Extendida en MBR.',
        '  SHRINK DESIRED=<MB>            - Reduce el tamaño de la partición seleccionada liberando espacio.',
        '  EXTEND [SIZE=<MB>]             - Amplía la partición seleccionada usando espacio libre contiguo.',
        '  FORMAT FS=<NTFS|FAT32|EXFAT|EXT4|SWAP> [UNIT=<512|4096|16384|32768|65536>] [LABEL="..."] [QUICK]',
        '  ACTIVE / INACTIVE              - Marca o desmarca la partición primaria MBR como Activa (Boot 0x80).',
        '  ASSIGN LETTER=<C..Z>           - Asigna letra de unidad o punto de montaje (/boot/efi, /, etc.).',
        '  DELETE PARTITION               - Elimina la partición actualmente seleccionada.',
      ].join('\n'),
    };
  }

  // Support Linux `fdisk -l` or `list disk`
  if (lower === 'list disk' || lower === 'fdisk -l') {
    const header =
      '  Núm Disco  Dispositivo    Estado         Tamaño     Disp.      Gpt  Modelo\n' +
      '  ---------  -------------  -------------  ---------  ---------  ---  ------------------------------';
    const rows = disks.map((d) => {
      const marker = d.id === selectedDiskId ? '*' : ' ';
      const space = calculateDiskSpace(d);
      const devStr = d.linuxDev.padEnd(13, ' ');
      const statusStr =
        d.partitionTable === 'RAW' ? 'Sin inicializ' : 'En línea     ';
      const sizeStr = formatCapacity(d.totalSizeMB).split(' (')[0].padEnd(9, ' ');
      const freeStr = formatCapacity(space.unallocatedAddressableMB)
        .split(' (')[0]
        .padEnd(9, ' ');
      const gptMark = d.partitionTable === 'GPT' ? ' * ' : '   ';
      return `${marker} Disco ${d.id}    ${devStr}  ${statusStr}  ${sizeStr}  ${freeStr}  ${gptMark}  ${d.model}`;
    });
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: 'fdisk -l',
      status: 'info',
      output: `${header}\n${rows.join('\n')}`,
    };
  }

  const selectDiskMatch = lower.match(/^select\s+disk\s+(\d+)$/);
  if (selectDiskMatch) {
    const targetId = parseInt(selectDiskMatch[1], 10);
    const found = disks.find((d) => d.id === targetId);
    if (!found) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `El disco especificado (${targetId}) no es válido. Usa "LIST DISK" para ver los discos (0, 1, 2).`,
      };
    }
    return {
      disks,
      selectedDiskId: found.id,
      selectedPartitionId: found.partitions[0]?.id || null,
      linuxEquivalent: `parted ${found.linuxDev}`,
      status: 'success',
      output: `El Disco ${found.id} (${found.linuxDev} — ${found.model}) es ahora el disco seleccionado.`,
    };
  }

  if (lower === 'detail disk') {
    const space = calculateDiskSpace(currentDisk);
    const totalSectors = Math.round(
      (currentDisk.totalSizeMB * 1024 * 1024) / currentDisk.sectorSize
    );
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `hdparm -I ${currentDisk.linuxDev}`,
      status: 'info',
      output: [
        `${currentDisk.model} (${currentDisk.linuxDev})`,
        `ID de disco: 0x8B0${currentDisk.id}F2A4 | Interfaz: ${currentDisk.interfaceType}`,
        `Estilo de tabla de particiones : ${currentDisk.partitionTable}`,
        `Tamaño de sector físico/lógico : ${currentDisk.sectorSize} bytes`,
        `Sectores LBA totales           : ${totalSectors.toLocaleString('es-ES')}`,
        `Capacidad física total         : ${formatCapacity(currentDisk.totalSizeMB)}`,
        `Capacidad direccionable actual : ${formatCapacity(space.addressableMB)}`,
        space.mbrLockedOver2TBMB > 0
          ? `ALERTA MBR 32-BIT LBA          : ${formatCapacity(space.mbrLockedOver2TBMB)} bloqueados por superar el límite de 2 TB.`
          : `Espacio libre no asignado      : ${formatCapacity(space.unallocatedAddressableMB)}`,
      ].join('\n'),
    };
  }

  if (lower === 'detail partition') {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: 'No hay ninguna partición seleccionada. Usa "SELECT PARTITION <N>".',
      };
    }
    const usage = calculatePartitionUsage(currentPart);
    const spec =
      currentPart.fileSystem !== 'RAW'
        ? FILESYSTEM_SPECS[currentPart.fileSystem]
        : null;
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `blkid ${getPartLinuxDev(currentDisk, currentPart.number)}`,
      status: 'info',
      output: [
        `Partición ${currentPart.number} (${getPartLinuxDev(currentDisk, currentPart.number)})`,
        `  Tipo en Tabla       : ${currentPart.role.toUpperCase()} (${
          currentDisk.partitionTable === 'GPT'
            ? spec?.gptGuid || 'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7'
            : spec?.mbrTypeHex || '0x00'
        })`,
        `  Sistema de Archivos : ${currentPart.fileSystem}`,
        `  Tamaño de Clúster   : ${currentPart.clusterSize} bytes`,
        `  Desplazamiento LBA  : ${currentPart.offsetMB} MB (${(
          (currentPart.offsetMB * 1024 * 1024) /
          currentDisk.sectorSize
        ).toLocaleString('es-ES')} sectores)`,
        `  Capacidad Volumen   : ${formatCapacity(currentPart.sizeMB)}`,
        `  Ocupado Físico      : ${formatBytes(usage.physicalUsedBytes)} (Slack Space: ${formatBytes(usage.slackTotalBytes)})`,
        `  Activa (MBR 0x80)   : ${currentPart.isActive ? 'Sí' : 'No'}`,
      ].join('\n'),
    };
  }

  if (lower === 'filesystems') {
    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      status: 'info',
      output: [
        'Sistemas de archivos disponibles para formateo en el simulador:',
        '  Tipo     Clúster Estándar   Archivo Máx.           Volumen Máx.   Características Clave',
        '  -------  -----------------  ---------------------  -------------  -----------------------------------------------',
        '  NTFS     4096 B (512B-64K)  16 TB / 8 PB           16 TB - 256TB  Journaling, ACLs, MFT Residente (<=700B)',
        '  FAT32    4096 B (512B-32K)  4 GB - 1 B (2^32 - 1)  32 GB / 2 TB   Estándar obligatorio UEFI ESP, sin Journaling',
        '  exFAT    32768 B (4K-64K)   16 EB                  128 PB         Ideal Flash/USB >32GB, supera límite 4GB FAT32',
        '  ext4     4096 B (1K-64K)    16 TB                  1 EB           Inodos + Extents Linux, Journaling JBD2',
        '  swap     4096 B (Página)    N/A (Paginación RAM)   16 TB          Área de intercambio de memoria virtual Linux',
      ].join('\n'),
    };
  }

  if (lower === 'clean' || lower.startsWith('wipefs')) {
    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id
        ? { ...d, partitionTable: 'RAW' as PartitionTableType, partitions: [] }
        : d
    );
    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId: null,
      linuxEquivalent: `wipefs -a ${currentDisk.linuxDev}`,
      status: 'success',
      output: `DiskPart ha limpiado el Disco ${currentDisk.id} (${currentDisk.linuxDev}) satisfactoriamente. El disco está ahora sin inicializar (RAW).`,
    };
  }

  if (
    lower === 'convert mbr' ||
    lower === 'convert gpt' ||
    lower === 'mklabel msdos' ||
    lower === 'mklabel gpt'
  ) {
    const targetTable: PartitionTableType =
      lower.endsWith('gpt') ? 'GPT' : 'MBR';
    if (currentDisk.partitions.length > 0) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `Error del servicio de disco virtual: El disco especificado no es convertible porque contiene particiones activas.\nEjecuta primero el comando "CLEAN" para vaciar el disco antes de convertir a ${targetTable}.`,
      };
    }

    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitionTable: targetTable } : d
    );

    const extraNote =
      targetTable === 'MBR' && currentDisk.totalSizeMB > MBR_MAX_ADDRESSABLE_MB
        ? `\nADVERTENCIA DIDÁCTICA: Al inicializar un disco de ${formatCapacity(currentDisk.totalSizeMB)} en MBR (LBA de 32 bits), solo los primeros 2 TB (2,097,152 MB) son direccionables.`
        : '';

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId: null,
      linuxEquivalent: `parted ${currentDisk.linuxDev} mklabel ${
        targetTable === 'GPT' ? 'gpt' : 'msdos'
      }`,
      status: 'success',
      output: `DiskPart convirtió correctamente el disco seleccionado al formato ${targetTable}.${extraNote}`,
    };
  }

  if (
    lower === 'list partition' ||
    lower === 'list volume' ||
    lower === 'lsblk'
  ) {
    if (currentDisk.partitions.length === 0) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        linuxEquivalent: `lsblk ${currentDisk.linuxDev}`,
        status: 'info',
        output: `No hay particiones en este disco para mostrar (${currentDisk.name}, Tabla: ${currentDisk.partitionTable}).`,
      };
    }
    const header =
      '  Partición ###  Dev Linux       Tipo        Tamaño     Sistema    Clúster   Activa  Letra/Monto   Etiqueta\n' +
      '  -------------  --------------  ----------  ---------  ---------  --------  ------  ------------  ----------------';
    const rows = currentDisk.partitions.map((p) => {
      const marker = p.id === selectedPartitionId ? '*' : ' ';
      const devLinux = getPartLinuxDev(currentDisk, p.number).padEnd(14, ' ');
      const roleLabel =
        p.role === 'primary'
          ? 'Primaria  '
          : p.role === 'extended'
            ? 'Extendida '
            : p.role === 'logical'
              ? 'Lógica    '
              : p.role === 'msr'
                ? 'ReservMSR '
                : 'SistemaEFI';
      const sizeStr = formatCapacity(p.sizeMB).split(' (')[0].padEnd(9, ' ');
      const fsStr = (
        p.role === 'extended'
          ? 'Contened.'
          : p.role === 'msr'
            ? 'MSR (RAW)'
            : p.fileSystem
      ).padEnd(9, ' ');
      const clStr = (
        p.role === 'extended' || p.role === 'msr' || p.fileSystem === 'RAW'
          ? '-'
          : p.clusterSize >= 1024
            ? `${p.clusterSize / 1024} KB`
            : `${p.clusterSize} B`
      ).padEnd(8, ' ');
      const actStr = p.isActive ? '  Sí  ' : '  No  ';
      const letStr = (p.driveLetter || '-').padEnd(12, ' ');
      return `${marker} Partición ${p.number}    ${devLinux}  ${roleLabel}  ${sizeStr}  ${fsStr}  ${clStr}  ${actStr}  ${letStr}  ${p.label || '(Sin etiqueta)'}`;
    });

    return {
      disks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `lsblk -f ${currentDisk.linuxDev}`,
      status: 'info',
      output: `${header}\n${rows.join('\n')}`,
    };
  }

  const selectPartMatch = lower.match(/^select\s+partition\s+(\d+)$/);
  if (selectPartMatch) {
    const num = parseInt(selectPartMatch[1], 10);
    const found = currentDisk.partitions.find((p) => p.number === num);
    if (!found) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `La partición especificada (${num}) no es válida. Usa "LIST PARTITION" para ver las particiones.`,
      };
    }
    return {
      disks,
      selectedDiskId,
      selectedPartitionId: found.id,
      status: 'success',
      output: `La Partición ${found.number} (${getPartLinuxDev(currentDisk, found.number)} — ${found.role.toUpperCase()}, ${formatCapacity(found.sizeMB)}) es ahora la partición seleccionada.`,
    };
  }

  const createPartMatch = lower.match(
    /^create\s+partition\s+(primary|efi|msr|extended|logical)(?:\s+size=(\d+))?$/
  );
  if (createPartMatch) {
    const role = createPartMatch[1] as PartitionRole;
    const space = calculateDiskSpace(currentDisk);
    const defaultAvailable =
      role === 'logical'
        ? space.extendedFreeMB
        : role === 'efi'
          ? Math.min(300, space.unallocatedAddressableMB)
          : role === 'msr'
            ? Math.min(16, space.unallocatedAddressableMB)
            : space.unallocatedAddressableMB;

    const requestedSizeMB = createPartMatch[2]
      ? parseInt(createPartMatch[2], 10)
      : defaultAvailable;

    const validation = validateCreatePartition(
      currentDisk,
      role,
      requestedSizeMB
    );
    if (!validation.valid) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `Error de DiskPart al crear la partición:\n${validation.error}`,
      };
    }

    const newPartId = `part-${currentDisk.id}-${Date.now()}`;
    const newPart: Partition = {
      id: newPartId,
      number: currentDisk.partitions.length + 1,
      label:
        role === 'efi'
          ? 'EFI-SYSTEM'
          : role === 'msr'
            ? 'MSR-Reservado'
            : role === 'extended'
              ? 'Contenedor-EBR'
              : 'Nuevo-Volumen',
      role,
      fileSystem: 'RAW',
      clusterSize: 4096,
      sizeMB: requestedSizeMB,
      offsetMB: space.allocatedTopLevelMB + 1,
      isActive: false,
      driveLetter:
        role === 'efi' ? 'S (ESP)' : role === 'msr' ? 'MSR' : undefined,
      files: [],
    };

    const nextPartitions = renumberPartitions([
      ...currentDisk.partitions,
      newPart,
    ]);
    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId: newPartId,
      linuxEquivalent: `parted ${currentDisk.linuxDev} mkpart ${role} ${newPart.offsetMB}MiB ${
        newPart.offsetMB + requestedSizeMB
      }MiB`,
      status: 'success',
      output: `DiskPart ha creado satisfactoriamente la partición especificada (${role.toUpperCase()} de ${formatCapacity(requestedSizeMB)}). Estado actual: RAW.`,
    };
  }

  // SHRINK DESIRED=<MB>
  const shrinkMatch = lower.match(/^shrink(?:\s+desired=(\d+))?$/);
  if (shrinkMatch) {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: 'Selecciona primero una partición ("SELECT PARTITION <N>") antes de ejecutar SHRINK.',
      };
    }
    const desiredMB = shrinkMatch[1]
      ? parseInt(shrinkMatch[1], 10)
      : Math.floor(currentPart.sizeMB * 0.25);

    const usage = calculatePartitionUsage(currentPart);
    const minUsedMB = Math.ceil(usage.physicalUsedBytes / (1024 * 1024)) + 100;

    if (desiredMB <= 0 || currentPart.sizeMB - desiredMB < minUsedMB) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `No se puede reducir la partición en ${formatCapacity(desiredMB)}. Tamaño mínimo requerido por los datos y metadatos actuales: ${formatCapacity(minUsedMB)}.`,
      };
    }

    const newSizeMB = currentPart.sizeMB - desiredMB;
    const nextPartitions = renumberPartitions(
      currentDisk.partitions.map((p) =>
        p.id === currentPart.id ? { ...p, sizeMB: newSizeMB } : p
      )
    );
    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `parted ${currentDisk.linuxDev} resizepart ${currentPart.number} ${newSizeMB}MiB`,
      status: 'success',
      output: `DiskPart redujo correctamente el volumen en ${formatCapacity(desiredMB)}. Nuevo tamaño de la Partición ${currentPart.number}: ${formatCapacity(newSizeMB)}.`,
    };
  }

  // EXTEND [SIZE=<MB>]
  const extendMatch = lower.match(/^extend(?:\s+size=(\d+))?$/);
  if (extendMatch) {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: 'Selecciona primero una partición ("SELECT PARTITION <N>") antes de ejecutar EXTEND.',
      };
    }
    const space = calculateDiskSpace(currentDisk);
    const maxFree =
      currentPart.role === 'logical'
        ? space.extendedFreeMB
        : space.unallocatedAddressableMB;

    const addMB = extendMatch[1] ? parseInt(extendMatch[1], 10) : maxFree;

    if (addMB <= 0 || addMB > maxFree) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `No hay suficiente espacio libre disponible para extender el volumen (Disponible: ${formatCapacity(maxFree)}).`,
      };
    }

    const newSizeMB = currentPart.sizeMB + addMB;
    const nextPartitions = renumberPartitions(
      currentDisk.partitions.map((p) =>
        p.id === currentPart.id ? { ...p, sizeMB: newSizeMB } : p
      )
    );
    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `parted ${currentDisk.linuxDev} resizepart ${currentPart.number} ${newSizeMB}MiB`,
      status: 'success',
      output: `DiskPart extendió correctamente el volumen en ${formatCapacity(addMB)}. Nuevo tamaño de la Partición ${currentPart.number}: ${formatCapacity(newSizeMB)}.`,
    };
  }

  if (lower.startsWith('format ')) {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output:
          'No hay ninguna partición seleccionada. Usa "SELECT PARTITION <N>" antes de ejecutar FORMAT.',
      };
    }

    const fsMatch = lower.match(/fs=(ntfs|fat32|exfat|ext4|swap)/i);
    if (!fsMatch) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output:
          'Sintaxis de formato incompleta. Especifica el sistema de archivos: FORMAT FS=NTFS | FAT32 | EXFAT | EXT4 | SWAP [UNIT=4096] [LABEL="Datos"] [QUICK]',
      };
    }

    const rawFs = fsMatch[1].toLowerCase();
    const targetFs: Exclude<FileSystemType, 'RAW'> =
      rawFs === 'ext4'
        ? 'ext4'
        : rawFs === 'swap'
          ? 'swap'
          : rawFs === 'exfat'
            ? 'exFAT'
            : (rawFs.toUpperCase() as 'NTFS' | 'FAT32');

    const unitMatch = lower.match(/unit=(512|4096|16384|32768|65536)/);
    const clusterSize: ClusterSize = unitMatch
      ? (parseInt(unitMatch[1], 10) as ClusterSize)
      : FILESYSTEM_SPECS[targetFs].defaultClusterBytes;

    const labelMatch =
      input.match(/label="([^"]+)"/i) || input.match(/label=(\S+)/i);
    const newLabel = labelMatch ? labelMatch[1] : currentPart.label;

    const validation = validateFormatPartition(
      currentPart,
      targetFs,
      clusterSize
    );
    if (!validation.valid) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: `Error al formatear el volumen:\n${validation.error}`,
      };
    }

    const nextPartitions = currentDisk.partitions.map((p) =>
      p.id === currentPart.id
        ? {
            ...p,
            fileSystem: targetFs,
            clusterSize,
            label: newLabel,
            files: [],
            driveLetter:
              targetFs === 'swap'
                ? '[SWAP]'
                : targetFs === 'ext4'
                  ? '/'
                  : p.role === 'efi'
                    ? 'S (ESP)'
                    : p.driveLetter || 'F:',
          }
        : p
    );

    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    const devPath = getPartLinuxDev(currentDisk, currentPart.number);
    const linuxCmd =
      targetFs === 'ext4'
        ? `mkfs.ext4 -b ${clusterSize} -L "${newLabel}" ${devPath}`
        : targetFs === 'FAT32'
          ? `mkfs.fat -F 32 -n "${newLabel}" ${devPath}`
          : targetFs === 'exFAT'
            ? `mkfs.exfat -c ${clusterSize} -L "${newLabel}" ${devPath}`
            : targetFs === 'swap'
              ? `mkswap -L "${newLabel}" ${devPath} && swapon ${devPath}`
              : `mkfs.ntfs -c ${clusterSize} -L "${newLabel}" -Q ${devPath}`;

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: linuxCmd,
      status: validation.warning ? 'warning' : 'success',
      output: [
        `  100 por ciento completado.`,
        `DiskPart formateó el volumen correctamente en ${targetFs} (Tamaño de clúster/bloque: ${clusterSize} bytes, Etiqueta: "${newLabel}").`,
        validation.warning ? `\n${validation.warning}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  if (lower === 'active' || lower === 'inactive') {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output:
          'No hay ninguna partición seleccionada. Usa "SELECT PARTITION <N>".',
      };
    }

    if (currentDisk.partitionTable !== 'MBR') {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output:
          'El comando ACTIVE solo es válido en discos con tabla MBR fija. En discos GPT el arranque se gestiona mediante la Partición del Sistema EFI (ESP).',
      };
    }

    if (currentPart.role !== 'primary') {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output:
          'La partición seleccionada no es una partición Primaria. En MBR solo una partición Primaria puede marcarse como Activa (flag 0x80).',
      };
    }

    const makeActive = lower === 'active';
    const nextPartitions = currentDisk.partitions.map((p) => ({
      ...p,
      isActive: p.id === currentPart.id ? makeActive : false,
    }));

    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `parted ${currentDisk.linuxDev} set ${currentPart.number} boot ${
        makeActive ? 'on' : 'off'
      }`,
      status: 'success',
      output: makeActive
        ? `DiskPart marcó la Partición ${currentPart.number} actual como ACTIVA (byte 0x80 escrito en la entrada MBR).`
        : `DiskPart marcó la Partición ${currentPart.number} actual como INACTIVA (byte 0x00).`,
    };
  }

  const assignMatch = input.match(/^assign(?:\s+letter=([a-zA-Z]|\/[\w/-]*))?$/i);
  if (assignMatch) {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: 'Selecciona una partición primero ("SELECT PARTITION <N>").',
      };
    }
    const rawLetter = assignMatch[1] || 'G';
    const formattedLetter = rawLetter.startsWith('/')
      ? rawLetter
      : `${rawLetter.toUpperCase()}:`;

    const nextPartitions = currentDisk.partitions.map((p) =>
      p.id === currentPart.id ? { ...p, driveLetter: formattedLetter } : p
    );
    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId,
      linuxEquivalent: `mount ${getPartLinuxDev(currentDisk, currentPart.number)} ${formattedLetter}`,
      status: 'success',
      output: `DiskPart asignó correctamente la letra de unidad o punto de montaje "${formattedLetter}" a la Partición ${currentPart.number}.`,
    };
  }

  if (lower === 'delete partition' || lower === 'delete partition override') {
    if (!currentPart) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output: 'No hay ninguna partición seleccionada para eliminar.',
      };
    }

    if (
      currentPart.role === 'extended' &&
      currentDisk.partitions.some((p) => p.role === 'logical')
    ) {
      return {
        disks,
        selectedDiskId,
        selectedPartitionId,
        status: 'error',
        output:
          'La Partición Extendida no está vacía. Debes eliminar primero todas las Unidades Lógicas alojadas en su interior antes de eliminar la Partición Extendida.',
      };
    }

    const filtered = currentDisk.partitions.filter(
      (p) => p.id !== currentPart.id
    );
    const nextPartitions = renumberPartitions(filtered);
    const nextDisks = disks.map((d) =>
      d.id === currentDisk.id ? { ...d, partitions: nextPartitions } : d
    );

    return {
      disks: nextDisks,
      selectedDiskId,
      selectedPartitionId: nextPartitions[0]?.id || null,
      linuxEquivalent: `parted ${currentDisk.linuxDev} rm ${currentPart.number}`,
      status: 'success',
      output: `DiskPart eliminó satisfactoriamente la partición seleccionada.`,
    };
  }

  return {
    disks,
    selectedDiskId,
    selectedPartitionId,
    status: 'error',
    output: `Comando "${input}" no reconocido. Escribe "HELP" para consultar la referencia completa de comandos DiskPart y utilidades Linux.`,
  };
}
