export type FirmwareType = 'BIOS' | 'UEFI';
export type PartitionTableType = 'RAW' | 'MBR' | 'GPT';
export type PartitionRole = 'primary' | 'extended' | 'logical' | 'efi' | 'msr';
export type FileSystemType = 'RAW' | 'NTFS' | 'FAT32' | 'exFAT' | 'ext4' | 'swap';
export type ClusterSize = 512 | 4096 | 16384 | 32768 | 65536;

export interface VirtualFile {
  id: string;
  name: string;
  sizeBytes: number; // Size of a single file in bytes
  count: number; // Number of files
  category: 'iso' | 'database' | 'small_batch' | 'system' | 'custom';
}

export interface Partition {
  id: string;
  number: number;
  label: string;
  role: PartitionRole;
  fileSystem: FileSystemType;
  clusterSize: ClusterSize;
  sizeMB: number;
  offsetMB: number;
  isActive: boolean; // MBR boot flag (0x80)
  driveLetter?: string; // e.g. 'C:', 'D:', '/boot/efi', '/', '[SWAP]'
  files: VirtualFile[];
}

export interface Disk {
  id: number;
  name: string;
  linuxDev: string; // e.g. '/dev/nvme0n1', '/dev/sda', '/dev/sdb'
  model: string;
  interfaceType: 'NVMe PCIe 4.0' | 'SATA III 6Gb/s' | 'USB 3.2 Gen 1';
  totalSizeMB: number;
  sectorSize: 512 | 4096;
  partitionTable: PartitionTableType;
  partitions: Partition[];
}

export interface TerminalEntry {
  id: string;
  timestamp: string;
  command?: string;
  linuxEquivalent?: string;
  output: string;
  status: 'info' | 'success' | 'warning' | 'error';
  source: 'cli' | 'gui';
}

export interface BootDiagnostic {
  canBoot: boolean;
  status: 'nominal' | 'warning' | 'error';
  headline: string;
  details: string[];
  recommendation?: string;
  simulatedScreenOutput: {
    screenTitle: string;
    screenType: 'windows-boot' | 'grub-menu' | 'bios-error' | 'uefi-shell-error';
    lines: string[];
  };
}

export interface ChallengeRequirement {
  id: string;
  label: string;
  passed: boolean;
}

export interface ChallengeScenario {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado';
  description: string;
  targetDiskId: number;
  recommendedFirmware: FirmwareType;
  hintCommand: string;
  linuxHintCommand: string;
  learningGoal: string;
}

export const MBR_MAX_ADDRESSABLE_MB = 2097152; // 2 TB = 2,097,152 MB (2^32 * 512 bytes)
export const FAT32_MAX_FILE_BYTES = 4294967295; // 4 GB - 1 byte (2^32 - 1)
export const FAT32_WINDOWS_FORMAT_LIMIT_MB = 32768; // 32 GB Windows GUI format limit
export const FAT32_MAX_VOLUME_MB = 2097152; // 2 TB with 512e sectors
export const NTFS_MFT_RESIDENT_THRESHOLD_BYTES = 700; // Files <= 700 B live inside MFT record!

export const FILESYSTEM_SPECS: Record<
  Exclude<FileSystemType, 'RAW'>,
  {
    name: string;
    fullName: string;
    osNative: string;
    maxFileSizeLabel: string;
    maxFileSizeBytes: number;
    maxVolumeSizeLabel: string;
    maxVolumeSizeMB: number;
    defaultClusterBytes: ClusterSize;
    journaling: boolean;
    permissions: string;
    mbrTypeHex: string;
    gptGuid: string;
    description: string;
    MetadataOverheadRatio: number;
  }
> = {
  NTFS: {
    name: 'NTFS',
    fullName: 'New Technology File System',
    osNative: 'Windows Server / Windows 10 & 11',
    maxFileSizeLabel: '16 TB (clúster 4 KB) / 256 TB (clúster 64 KB) / 8 PB (clúster 2 MB, Windows 10 1709+)',
    maxFileSizeBytes: 16 * 1024 * 1024 * 1024 * 1024,
    maxVolumeSizeLabel: '16 TB (4 KB clúster) / 256 TB (64 KB)',
    maxVolumeSizeMB: 16 * 1024 * 1024,
    defaultClusterBytes: 4096,
    journaling: true,
    permissions: 'ACL completas, cifrado EFS, cuotas, compresión, archivos residentes en MFT (<=700B)',
    mbrTypeHex: '0x07 (IFS/NTFS)',
    gptGuid: 'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7',
    description:
      'Sistema transaccional con Master File Table (MFT) y Journaling ($LogFile). Los archivos muy pequeños (<= 700 B) se almacenan como atributos residentes dentro del propio registro MFT de 1 KB sin ocupar clústeres de datos ni generar Slack Space.',
    MetadataOverheadRatio: 0.015,
  },
  FAT32: {
    name: 'FAT32',
    fullName: 'File Allocation Table (32-bit)',
    osNative: 'Universal (UEFI Firmware ESP, Windows, Linux, macOS)',
    maxFileSizeLabel: '4 GB menos 1 byte (4,294,967,295 B)',
    maxFileSizeBytes: FAT32_MAX_FILE_BYTES,
    maxVolumeSizeLabel: '32 GB (límite asistente Windows) / 2 TB (técnico)',
    maxVolumeSizeMB: FAT32_MAX_VOLUME_MB,
    defaultClusterBytes: 4096,
    journaling: false,
    permissions: 'Sin permisos ACL ni seguridad a nivel de archivo',
    mbrTypeHex: '0x0C (FAT32 LBA)',
    gptGuid: 'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7',
    description:
      'Obligatorio para la Partición del Sistema EFI (ESP, GUID C12A7328-...) en arranque UEFI. Su campo de longitud de archivo de 32 bits impide almacenar archivos individuales de 4 GB o más.',
    MetadataOverheadRatio: 0.004,
  },
  exFAT: {
    name: 'exFAT',
    fullName: 'Extended File Allocation Table (64-bit)',
    osNative: 'Unidades Flash USB, Tarjetas SDXC (Windows, macOS, Linux)',
    maxFileSizeLabel: '16 EB (Exabytes) — Supera el límite de 4 GB de FAT32',
    maxFileSizeBytes: 16 * 1024 * 1024 * 1024 * 1024,
    maxVolumeSizeLabel: '128 PB (Petabytes)',
    maxVolumeSizeMB: 128 * 1024 * 1024,
    defaultClusterBytes: 32768,
    journaling: false,
    permissions: 'Ligero, sin sobrecarga de listas ACL ni MFT pesada',
    mbrTypeHex: '0x07 (exFAT/NTFS)',
    gptGuid: 'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7',
    description:
      'Diseñado por Microsoft para memorias flash y almacenamiento externo multiplataforma. Elimina el límite de 4 GB por archivo y 32 GB de volumen de FAT32 usando punteros de 64 bits y mapas de bits de clústeres libres.',
    MetadataOverheadRatio: 0.003,
  },
  ext4: {
    name: 'ext4',
    fullName: 'Fourth Extended Filesystem',
    osNative: 'GNU/Linux (Debian, Ubuntu, RHEL, Arch)',
    maxFileSizeLabel: '16 TB (con tamaño de bloque de 4 KB)',
    maxFileSizeBytes: 16 * 1024 * 1024 * 1024 * 1024,
    maxVolumeSizeLabel: '1 EB (Exabyte)',
    maxVolumeSizeMB: 1024 * 1024 * 1024,
    defaultClusterBytes: 4096,
    journaling: true,
    permissions: 'POSIX (rwx usuario/grupo/otros), atributos extendidos, SELinux',
    mbrTypeHex: '0x83 (Linux Native)',
    gptGuid: '0FC63DAF-8483-4772-8E79-3D69D8477DE4',
    description:
      'Utiliza tablas de inodos, grupos de bloques y asignación contigua por extents (hasta 128 MB por extent), minimizando la fragmentación y garantizando integridad mediante Journaling JBD2.',
    MetadataOverheadRatio: 0.018,
  },
  swap: {
    name: 'swap',
    fullName: 'Linux Swap Area (Memoria Virtual de Intercambio)',
    osNative: 'GNU/Linux Kernel',
    maxFileSizeLabel: 'No almacena archivos de usuario (Paginación de RAM)',
    maxFileSizeBytes: 0,
    maxVolumeSizeLabel: 'Hasta 16 TB',
    maxVolumeSizeMB: 16 * 1024 * 1024,
    defaultClusterBytes: 4096,
    journaling: false,
    permissions: 'Exclusivo del Kernel Linux (swapon)',
    mbrTypeHex: '0x82 (Linux Swap)',
    gptGuid: '0657FD6D-A4AB-43C4-84E5-0933C84B4F4F',
    description:
      'Partición dedicada sin árbol de directorios que el kernel de Linux utiliza para paginar páginas de memoria RAM inactivas y soportar hibernación (suspend-to-disk).',
    MetadataOverheadRatio: 0.001,
  },
};

export const PRESET_TEST_FILES: VirtualFile[] = [
  {
    id: 'preset-iso-4.7gb',
    name: 'ubuntu_24_04_desktop_amd64.iso',
    sizeBytes: Math.round(4.7 * 1024 * 1024 * 1024), // 4.7 GB -> fails on FAT32!
    count: 1,
    category: 'iso',
  },
  {
    id: 'preset-iot-logs',
    name: 'telemetria_sensores_10k.json',
    sizeBytes: 1228, // 1.2 KB per file
    count: 10000, // 10,000 tiny files -> huge slack space with 32KB/64KB clusters!
    category: 'small_batch',
  },
  {
    id: 'preset-mft-resident',
    name: 'claves_ssh_micro_512b.pub',
    sizeBytes: 512, // 512 B per file -> Resident in NTFS MFT (0 data clusters!), huge slack in FAT32/exFAT!
    count: 25000,
    category: 'small_batch',
  },
  {
    id: 'preset-sql-db',
    name: 'produccion_erp_warehouse.mdf',
    sizeBytes: Math.round(18.5 * 1024 * 1024 * 1024), // 18.5 GB
    count: 1,
    category: 'database',
  },
  {
    id: 'preset-efi-boot',
    name: 'bootx64.efi',
    sizeBytes: 1536 * 1024, // 1.5 MB
    count: 1,
    category: 'system',
  },
];
