import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';

// ── Helpers ────────────────────────────────────────────────────────────────

type CellValue = string | number | boolean | null | undefined;

function parseVNNumber(str: CellValue): number {
  if (str === null || str === undefined || str === '') return 0;
  const s = String(str).trim();
  if (s === '-' || s === '0,00' || s === '0.00') return 0;
  // "1.000,00" → remove dots → replace comma → parse
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned)) || 0;
}

function parseQty(str: CellValue): number {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n);
}

function trimStr(val: unknown): string {
  return (val ? String(val).trim() : '');
}

function normalizeCategory(raw: string): string {
  return raw.replace(/^NHOM\s+/i, '').trim();
}

// Row columns (0-indexed) matching File 1:
// 0:Mã vạch 1:Tên thuốc 2:Nhóm thuốc 3:ĐVT lẻ 4:Giá bán lẻ 5:Giá nhập
// 6:ĐVT chẵn 7:Quy đổi 8:Giá bán chẵn 9:Giá bán lớn 10:Không HSD
// 11:Mã sẵn có 12:Hãng SX 13:Ảnh 14-17:storage flags 18-21:dosage
// 22:Quy cách 23:ĐVT lớn 24:Quy đổi lớn 25:Giá nhập chẵn 26:Giá nhập lớn
// 27:Giá sỉ 28:Giá sỉ chẵn 29:Giá sỉ lớn 30:Vị trí

interface ParsedProduct {
  barcode: string;
  name: string;
  rawCategory: string;
  unit: string;
  packagingInfo: string;
  manufacturer: string;
  basePrice: number;
  currentPrice: number;
  quyDoi: number;
  giaSiChan: number;
  quyDoiLon: number;
  giaSiLon: number;
  rowIndex: number;
}

export interface PreviewResult {
  totalRows: number;
  toCreate: ParsedProduct[];
  toUpdate: ParsedProduct[];
  errors: { rowIndex: number; reason: string; name?: string }[];
  newRawCategories: string[];
  missingProducts: { id: string; name: string; barcode: string }[];
  existingCategoryMappings: Record<string, string>;
}

export interface ExecuteChoices {
  categoryMappings: { rawName: string; displayName: string }[];
  missingActions: { productId: string; action: 'deactivate' | 'keep'; reason?: string }[];
}

@Injectable()
export class AdminImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Parse file → preview ──────────────────────────────────────────────────

  async preview(buffer: Buffer, filename: string): Promise<PreviewResult> {
    const rows = this.parseExcel(buffer);
    const toCreate: ParsedProduct[] = [];
    const toUpdate: ParsedProduct[] = [];
    const errors: { rowIndex: number; reason: string; name?: string }[] = [];

    const barcodesSeen = new Set<string>();
    const barcodeInFile = new Set<string>();

    for (const [rowIndex, row] of rows.entries()) {
      try {
        const parsed = this.parseRow(row, rowIndex + 2);
        if (!parsed) continue;

        const { barcode, currentPrice, name } = parsed;

        if (!barcode) {
          errors.push({ rowIndex: rowIndex + 2, reason: 'Thiếu mã vạch và mã sẵn có', name });
          continue;
        }

        if (barcodesSeen.has(barcode)) {
          errors.push({ rowIndex: rowIndex + 2, reason: `Mã vạch trùng trong file: ${barcode}`, name });
          continue;
        }
        barcodesSeen.add(barcode);
        barcodeInFile.add(barcode);

        const existing = await this.prisma.product.findFirst({
          where: { OR: [{ barcode }, { sku: barcode }] },
          select: { id: true },
        });

        if (currentPrice === 0) {
          errors.push({ rowIndex: rowIndex + 2, reason: 'Giá sỉ = 0, sẽ nhập ẩn (isActive=false)', name });
        }

        if (existing) {
          toUpdate.push(parsed);
        } else {
          toCreate.push(parsed);
        }
      } catch (e) {
        errors.push({ rowIndex: rowIndex + 2, reason: String(e) });
      }
    }

    // Products in DB but not in file
    const allBarcodes = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, barcode: true, sku: true },
    });
    const missingProducts = allBarcodes.filter((p) => {
      const code = p.barcode || p.sku;
      return code && !barcodeInFile.has(code);
    }).map((p) => ({ id: p.id, name: p.name, barcode: p.barcode || p.sku || '' }));

    // New categories not in mapping
    const allRawCats = new Set([
      ...toCreate.map((p) => p.rawCategory),
      ...toUpdate.map((p) => p.rawCategory),
    ]);
    const existingMappings = await this.prisma.categoryMapping.findMany();
    const existingMappingMap: Record<string, string> = {};
    for (const m of existingMappings) {
      existingMappingMap[m.rawName] = m.displayName;
    }
    const newRawCategories = [...allRawCats].filter((c) => c && !existingMappingMap[c]);

    return {
      totalRows: rows.length,
      toCreate,
      toUpdate,
      errors,
      newRawCategories,
      missingProducts,
      existingCategoryMappings: existingMappingMap,
    };
  }

  // ── Execute import ─────────────────────────────────────────────────────────

  async execute(
    buffer: Buffer,
    filename: string,
    choices: ExecuteChoices,
  ) {
    // Save category mappings first
    for (const { rawName, displayName } of choices.categoryMappings) {
      if (!rawName || !displayName) continue;
      await this.prisma.categoryMapping.upsert({
        where: { rawName },
        update: { displayName },
        create: { rawName, displayName },
      });
    }

    // Reload all mappings
    const mappings = await this.prisma.categoryMapping.findMany();
    const catMap: Record<string, string> = {};
    for (const m of mappings) catMap[m.rawName] = m.displayName;

    const rows = this.parseExcel(buffer);
    const barcodeInFile = new Set<string>();
    let created = 0, updated = 0, skipped = 0;
    const logErrors: { rowIndex: number; reason: string }[] = [];

    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2;
      try {
        const parsed = this.parseRow(row, rowNum);
        if (!parsed) continue;

        const { barcode, name, rawCategory, unit, packagingInfo, manufacturer,
          basePrice, currentPrice, quyDoi, giaSiChan, quyDoiLon, giaSiLon } = parsed;

        if (!barcode) {
          logErrors.push({ rowIndex: rowNum, reason: 'Thiếu mã vạch' });
          skipped++;
          continue;
        }
        if (barcodeInFile.has(barcode)) { skipped++; continue; }
        barcodeInFile.add(barcode);

        const displayCategory = catMap[rawCategory] || normalizeCategory(rawCategory) || rawCategory;
        const isActive = currentPrice > 0;
        const tierPricingData = this.buildTierPricing(currentPrice, quyDoi, giaSiChan, quyDoiLon, giaSiLon);

        const existing = await this.prisma.product.findFirst({
          where: { OR: [{ barcode }, { sku: barcode }] },
          select: { id: true, currentPrice: true },
        });

        const productData = {
          name,
          sku: barcode,
          barcode,
          category: displayCategory,
          manufacturer,
          unit,
          packagingInfo,
          images: [],
          basePrice,
          currentPrice,
          previousPrice: existing?.currentPrice ?? undefined,
          priceChangePercent: existing?.currentPrice
            ? Math.round(((currentPrice - existing.currentPrice) / existing.currentPrice) * 100)
            : undefined,
          isVAT: true,
          isActive,
          stockQuantity: existing ? undefined : 0,
        };

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: { ...productData, stockQuantity: undefined },
          });
          await this.prisma.tierPrice.deleteMany({ where: { productId: existing.id } });
          if (tierPricingData.length > 0) {
            await this.prisma.tierPrice.createMany({
              data: tierPricingData.map((t) => ({ ...t, productId: existing.id })),
            });
          }
          updated++;
        } else {
          const created_product = await this.prisma.product.create({
            data: { ...productData, stockQuantity: 0 },
          });
          if (tierPricingData.length > 0) {
            await this.prisma.tierPrice.createMany({
              data: tierPricingData.map((t) => ({ ...t, productId: created_product.id })),
            });
          }
          created++;
        }
      } catch (e) {
        logErrors.push({ rowIndex: rowNum, reason: String(e) });
        skipped++;
      }
    }

    // Handle missing products
    let deactivated = 0, kept = 0;
    for (const action of choices.missingActions) {
      if (action.action === 'deactivate') {
        await this.prisma.product.update({
          where: { id: action.productId },
          data: { isActive: false, discontinuedReason: action.reason || 'Ngừng kinh doanh' },
        });
        deactivated++;
      } else {
        kept++;
      }
    }

    // Log
    await this.prisma.importLog.create({
      data: {
        type: 'products',
        fileName: filename,
        totalRows: rows.length,
        created,
        updated,
        deactivated,
        skipped,
        kept,
        errors: logErrors.length > 0 ? (logErrors as object[]) : undefined,
      },
    });

    return { created, updated, deactivated, kept, skipped, errors: logErrors };
  }

  // ── Category mappings ─────────────────────────────────────────────────────

  getMappings() {
    return this.prisma.categoryMapping.findMany({ orderBy: { rawName: 'asc' } });
  }

  async saveMappings(mappings: { rawName: string; displayName: string }[]) {
    for (const m of mappings) {
      await this.prisma.categoryMapping.upsert({
        where: { rawName: m.rawName },
        update: { displayName: m.displayName },
        create: m,
      });
    }
    return this.getMappings();
  }

  getLogs() {
    return this.prisma.importLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private parseExcel(buffer: Buffer): unknown[][] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    // Skip header row (row 0)
    return (data.slice(1) as unknown[][]).filter(
      (row) => row && row.length > 1 && trimStr(row[0]) !== 'Mã vạch',
    );
  }

  private parseRow(row: unknown[], rowNum: number): ParsedProduct | null {
    const col = (i: number): CellValue => (row[i] as CellValue) ?? '';
    const barcode = trimStr(col(0)) || trimStr(col(11));
    const name = trimStr(col(1));

    if (!name) return null;

    const rawCategory = trimStr(col(2));
    const unit = trimStr(col(3)) || 'Hộp';
    const basePrice = parseVNNumber(col(5));
    const quyDoi = parseQty(col(7));
    const packagingInfo = trimStr(col(22));
    const manufacturer = trimStr(col(12));
    const quyDoiLon = parseQty(col(24));
    const currentPrice = parseVNNumber(col(27));
    const giaSiChan = parseVNNumber(col(28));
    const giaSiLon = parseVNNumber(col(29));

    return {
      barcode,
      name,
      rawCategory,
      unit,
      packagingInfo,
      manufacturer,
      basePrice,
      currentPrice,
      quyDoi,
      giaSiChan,
      quyDoiLon,
      giaSiLon,
      rowIndex: rowNum,
    };
  }

  private buildTierPricing(
    currentPrice: number,
    quyDoi: number,
    giaSiChan: number,
    quyDoiLon: number,
    giaSiLon: number,
  ) {
    const tiers: { minQuantity: number; price: number }[] = [];

    if (quyDoi > 0 && giaSiChan > 0) {
      const pricePerUnit = Math.round(giaSiChan / quyDoi);
      tiers.push({ minQuantity: quyDoi, price: pricePerUnit });
    }

    if (quyDoi > 0 && quyDoiLon > 0 && giaSiLon > 0) {
      const totalUnits = quyDoi * quyDoiLon;
      const pricePerUnit = Math.round(giaSiLon / totalUnits);
      tiers.push({ minQuantity: totalUnits, price: pricePerUnit });
    }

    return tiers;
  }
}
