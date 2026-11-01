import { describe, expect, it } from 'vitest';
import { Disk, FAT32_MAX_FILE_BYTES, Partition, PRESET_TEST_FILES } from '../types/storage';
import {
  CHALLENGE_SCENARIOS,
  createInitialDisks,
  evaluateBootDiagnostic,
  evaluateChallenge,
  executeDiskpartCommand,
  formatCapacity,
  formatVendorCapacity,
  generateSectorHexInspection,
  lbaToChsHex,
  validateAddFileToPartition,
  validateFormatPartition,
} from './diskEngine';

interface Session {
  disks: Disk[];
  diskId: number;
  partId: string | null;
  outputs: string[];
}

function run(commands: string[], start?: Session): Session {
  const s: Session = start ?? { disks: createInitialDisks(), diskId: 0, partId: 'part-0-3', outputs: [] };
  for (const cmd of commands) {
    const r = executeDiskpartCommand(cmd, s.disks, s.diskId, s.partId);
    s.disks = r.disks;
    s.diskId = r.selectedDiskId;
    s.partId = r.selectedPartitionId;
    s.outputs.push(`${r.status}: ${r.output}`);
  }
  return s;
}

const disk = (s: Session, id: number) => s.disks.find((d) => d.id === id)!;

describe('discos iniciales', () => {
  it('las particiones caben en cada disco', () => {
    for (const d of createInitialDisks()) {
      const used = d.partitions.reduce((acc, p) => acc + p.sizeMB, 0) + 1;
      expect(used, d.name).toBeLessThanOrEqual(d.totalSizeMB);
    }
  });

  it('muestran la capacidad que ve el sistema y la comercial del fabricante', () => {
    const [nvme, hdd, usb] = createInitialDisks();
    expect(formatCapacity(nvme.totalSizeMB)).toMatch(/^465\.8 GB/);
    expect(formatVendorCapacity(nvme.totalSizeMB)).toBe('500.1 GB');
    expect(formatCapacity(hdd.totalSizeMB)).toMatch(/^3\.64 TB/);
    expect(formatVendorCapacity(hdd.totalSizeMB)).toBe('4.00 TB');
    expect(formatVendorCapacity(usb.totalSizeMB)).toBe('30.8 GB');
  });

  it('el disco 0 arranca en UEFI + GPT', () => {
    expect(evaluateBootDiagnostic(createInitialDisks()[0], 'UEFI').canBoot).toBe(true);
  });
});

describe('retos: la pista de cada reto lo completa', () => {
  for (const scenario of CHALLENGE_SCENARIOS) {
    it(scenario.title, () => {
      const commands = scenario.hintCommand
        .split('->')
        .map((c) => c.trim())
        .filter(Boolean);
      // La pista del reto 4 termina con una instrucción entre paréntesis: se quita del último comando
      const clean = commands.map((c) => c.replace(/\s*\(y luego.*$/, ''));
      const s = run(clean, {
        disks: createInitialDisks(),
        diskId: scenario.targetDiskId,
        partId: null,
        outputs: [],
      });
      expect(s.outputs.filter((o) => o.startsWith('error'))).toEqual([]);

      if (scenario.id === 'reto-4-fat32-4gb-limit') {
        const iso = PRESET_TEST_FILES.find((f) => f.category === 'iso')!;
        const part = disk(s, 2).partitions[0];
        expect(validateAddFileToPartition(part, iso).valid).toBe(true);
        part.files.push(iso);
      }

      const reqs = evaluateChallenge(scenario.id, s.disks, scenario.recommendedFirmware);
      expect(reqs.filter((r) => !r.passed).map((r) => r.label)).toEqual([]);
    });
  }

  it('el reto 2 se hace en el HDD SATA, no en el NVMe', () => {
    const reto2 = CHALLENGE_SCENARIOS.find((c) => c.id === 'reto-2-mbr-extended')!;
    expect(reto2.targetDiskId).toBe(1);
  });
});

describe('arranque', () => {
  it('una BIOS Legacy no arranca desde NVMe aunque el MBR sea correcto', () => {
    const s = run(['clean', 'convert mbr', 'create partition primary size=51200', 'format fs=ntfs quick', 'active']);
    expect(evaluateBootDiagnostic(disk(s, 0), 'BIOS').canBoot).toBe(false);
  });

  it('BIOS + MBR con primaria activa en NTFS arranca desde el HDD SATA', () => {
    const s = run(['select disk 1', 'select partition 1', 'active']);
    expect(evaluateBootDiagnostic(disk(s, 1), 'BIOS').canBoot).toBe(true);
  });
});

describe('sector 0 en hexadecimal', () => {
  it('CHS de la LBA 2048 es 20 21 00 y por encima de 8 GB se marca FE FF FF', () => {
    expect(lbaToChsHex(2048)).toBe('20 21 00');
    expect(lbaToChsHex(0)).toBe('00 01 00');
    expect(lbaToChsHex(200_000_000)).toBe('FE FF FF');
  });

  it('cada entrada MBR lleva su propia LBA de inicio', () => {
    const s = run([
      'select disk 1', 'clean', 'convert mbr',
      'create partition primary size=1024',
      'create partition primary size=2048',
    ]);
    const entries = generateSectorHexInspection(disk(s, 1)).blocks.filter((b) => b.title.startsWith('Entrada MBR'));
    const startLba = (hex: string) => hex.split(' ').slice(8, 12).join(' ');
    expect(startLba(entries[0].hexBytes)).toBe('00 08 00 00'); // 1 MB = LBA 2048
    expect(startLba(entries[1].hexBytes)).toBe('00 08 20 00'); // 1025 MB = LBA 2.099.200 = 0x200800
  });
});

describe('particiones lógicas', () => {
  it('se numeran desde 5 y empiezan dentro de la extendida', () => {
    const s = run([
      'select disk 1', 'clean', 'convert mbr',
      'create partition primary size=10240',
      'create partition extended size=20480',
      'create partition logical size=5120',
      'create partition logical size=5120',
    ]);
    const parts = disk(s, 1).partitions;
    const ext = parts.find((p) => p.role === 'extended')!;
    const logicals = parts.filter((p) => p.role === 'logical');
    expect(logicals.map((p) => p.number)).toEqual([5, 6]);
    for (const l of logicals) {
      expect(l.offsetMB).toBeGreaterThan(ext.offsetMB);
      expect(l.offsetMB + l.sizeMB).toBeLessThanOrEqual(ext.offsetMB + ext.sizeMB);
    }
  });
});

describe('formato y letras', () => {
  const part = (sizeMB: number, role: Partition['role'] = 'primary'): Partition => ({
    id: 'x', number: 1, label: '', role, fileSystem: 'RAW', clusterSize: 4096,
    sizeMB, offsetMB: 1, isActive: false, files: [],
  });

  it('FAT32 necesita al menos 65.525 clústeres (ESP de 300 MB: 4 KB sí, 16 KB no)', () => {
    expect(validateFormatPartition(part(300, 'efi'), 'FAT32', 4096).valid).toBe(true);
    expect(validateFormatPartition(part(300, 'efi'), 'FAT32', 16384).valid).toBe(false);
  });

  it('ext4 no admite bloques de 512 B', () => {
    expect(validateFormatPartition(part(10240), 'ext4', 512).valid).toBe(false);
    expect(validateFormatPartition(part(10240), 'ext4', 4096).valid).toBe(true);
  });

  it('formatear no inventa letras y no se puede repetir una letra', () => {
    const s = run(['create partition primary size=10240', 'format fs=ntfs quick']);
    const nueva = disk(s, 0).partitions.find((p) => p.id === s.partId)!;
    expect(nueva.driveLetter).toBeUndefined();
    const r = run(['assign letter=C'], s);
    expect(r.outputs.at(-1)).toMatch(/^error: .*ya está en uso/);
  });

  it('FAT32 rechaza un archivo de 4 GB o más; exFAT lo acepta', () => {
    const iso = PRESET_TEST_FILES.find((f) => f.sizeBytes > FAT32_MAX_FILE_BYTES)!;
    const usb = createInitialDisks()[2].partitions[0];
    expect(validateAddFileToPartition(usb, iso).valid).toBe(false);
    expect(validateAddFileToPartition({ ...usb, fileSystem: 'exFAT', clusterSize: 65536 }, iso).valid).toBe(true);
  });
});
