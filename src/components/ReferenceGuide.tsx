import React from 'react';
import { BookOpen, Cpu, Database, HardDrive } from 'lucide-react';
import { FILESYSTEM_SPECS } from '../types/storage';

export const ReferenceGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Section 1: MBR vs GPT Comparison Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">
            01. Tablas de Particiones: MBR (Master Boot Record) vs. GPT (GUID Partition Table)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Parámetro Arquitectónico</th>
                <th className="py-2.5 px-3">MBR (Master Boot Record — 1983)</th>
                <th className="py-2.5 px-3">GPT (GUID Partition Table — Estándar UEFI)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">
                  Direccionamiento de Sectores (LBA)
                </td>
                <td className="py-2.5 px-3 font-mono text-amber-300">
                  32 bits (máx. 2³² sectores = 4,294,967,296 sectores)
                </td>
                <td className="py-2.5 px-3 font-mono text-emerald-300">
                  64 bits (máx. 2⁶⁴ sectores)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">
                  Capacidad Máxima Direccionable (Sector 512 B)
                </td>
                <td className="py-2.5 px-3 font-mono">
                  2 TB (2,097,152 MB). Todo espacio &gt; 2 TB queda inaccesible
                </td>
                <td className="py-2.5 px-3 font-mono">
                  9.4 ZB (Zettabytes) teóricos / 18 EB prácticos
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">
                  Número Máximo de Particiones
                </td>
                <td className="py-2.5 px-3">
                  <strong className="text-amber-300">4 Primarias</strong> (64 bytes = 4 entradas × 16 B) o <strong className="text-sky-300">3 Primarias + 1 Extendida</strong> (con Unidades Lógicas encadenadas por EBR)
                </td>
                <td className="py-2.5 px-3">
                  <strong className="text-emerald-300">128 Particiones Primarias</strong> en Windows (sin necesidad de particiones extendidas ni lógicas)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">
                  Redundancia y Tolerancia a Fallos
                </td>
                <td className="py-2.5 px-3">
                  Punto único de fallo en LBA 0 (si se corrompe el Sector 0 se pierde toda la tabla)
                </td>
                <td className="py-2.5 px-3">
                  Cabecera GPT Primaria en LBA 1 + Copia de seguridad Secundaria al final del disco + sumas de verificación CRC32
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">
                  Firmware de Arranque Nativo
                </td>
                <td className="py-2.5 px-3">
                  BIOS / Legacy (o UEFI con módulo CSM activado). Requiere marcar 1 primaria como <code className="text-sky-300">Activa (0x80)</code>
                </td>
                <td className="py-2.5 px-3">
                  UEFI nativo. Requiere una <code className="text-emerald-300">Partición del Sistema EFI (ESP)</code> formateada en FAT32
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: BIOS/Legacy vs UEFI Boot Sequence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-bold">
            <Cpu className="w-4 h-4" />
            SECUENCIA DE ARRANQUE BIOS / LEGACY (16-BIT REAL MODE)
          </div>
          <h3 className="text-base font-bold text-white">
            Flujo de Ejecución por Sector Físico (MBR)
          </h3>
          <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
            <li>
              <strong className="text-white">POST en ROM BIOS:</strong> Inicializa hardware en modo real de 16 bits y lee los primeros 512 bytes (Sector 0 / LBA 0) en la dirección de memoria <code>0x0000:0x7C00</code>.
            </li>
            <li>
              <strong className="text-white">Código Maestro MBR (440 bytes):</strong> Examina las 4 entradas de 16 bytes de la tabla de particiones buscando la única partición Primaria con el byte de estado <code className="text-sky-300">0x80 (Activa)</code>.
            </li>
            <li>
              <strong className="text-white">Salto al VBR (Volume Boot Record):</strong> Ejecuta el sector de arranque de la partición activa, que invoca a <code className="text-amber-300">bootmgr</code> (Windows) o Stage 1.5 de GRUB.
            </li>
          </ol>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold">
            <Cpu className="w-4 h-4" />
            SECUENCIA DE ARRANQUE UEFI MODERNO (32/64-BIT)
          </div>
          <h3 className="text-base font-bold text-white">
            Flujo de Ejecución por Sistema de Archivos (GPT + ESP)
          </h3>
          <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
            <li>
              <strong className="text-white">Gestor de Arranque UEFI (NVRAM):</strong> El firmware comprende tablas GPT y posee un controlador nativo del sistema de archivos <code className="text-emerald-300">FAT32</code>.
            </li>
            <li>
              <strong className="text-white">Montaje de la Partición EFI (ESP):</strong> Localiza la partición con GUID <code className="text-sky-300">C12A7328-...</code> formateada en FAT32 (100–512 MB).
            </li>
            <li>
              <strong className="text-white">Ejecución de Aplicación EFI:</strong> Carga directamente binarios ejecutables como <code className="text-emerald-300">\EFI\Microsoft\Boot\bootmgfw.efi</code> o <code className="text-emerald-300">\EFI\ubuntu\grubx64.efi</code> verificando firmas de Secure Boot.
            </li>
          </ol>
        </div>
      </div>

      {/* Section 3: Filesystems Technical Matrix (NTFS vs FAT32 vs exFAT vs ext4 vs swap) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">
            02. Sistemas de Archivos: NTFS, FAT32, exFAT, ext4 y Linux Swap
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(['NTFS', 'FAT32', 'exFAT', 'ext4', 'swap'] as const).map((fsKey) => {
            const spec = FILESYSTEM_SPECS[fsKey];
            return (
              <div
                key={fsKey}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-white">
                      {spec.name}
                    </span>
                    <span className="text-xs font-mono text-sky-300">
                      {spec.journaling ? 'Con Journaling' : 'Sin Journaling'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {spec.fullName} · {spec.osNative}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {spec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Archivo máx.:</span>
                    <span className="text-white text-right">
                      {spec.maxFileSizeLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Volumen máx.:</span>
                    <span className="text-white text-right">
                      {spec.maxVolumeSizeLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">ID MBR / GPT:</span>
                    <span className="text-emerald-300 text-right truncate">
                      {spec.mbrTypeHex}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 space-y-1.5">
          <div className="font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            Fórmula de Ocupación Física, Slack Space y Atributos Residentes MFT
          </div>
          <p className="font-mono text-sky-200">
            Clústeres Ocupados = N_archivos × ⌈ Tamaño_Archivo_Bytes / Tamaño_Clúster_Bytes ⌉
          </p>
          <p className="font-mono text-amber-200">
            Slack Space (Desperdicio) = (Clústeres_Ocupados × Tamaño_Clúster_Bytes) − (N_archivos × Tamaño_Archivo_Bytes)
          </p>
          <p className="text-slate-400">
            Excepción técnica en <strong>NTFS</strong>: Cada archivo dispone de un registro de 1 KB (1024 bytes) en la Master File Table (MFT). Cuando el archivo es menor o igual a ~700 bytes, NTFS almacena el contenido completo dentro del propio registro MFT (Atributo <code>$DATA</code> Residente), requiriendo 0 clústeres adicionales de datos y 0 bytes de Slack Space.
          </p>
        </div>
      </div>
    </div>
  );
};
