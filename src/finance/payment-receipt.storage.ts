import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, extname } from 'path';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export type ReceiptUploadFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname?: string;
};

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

@Injectable()
export class PaymentReceiptStorage {
  private readonly rootDir = join(process.cwd(), 'uploads', 'payment-receipts');

  validateFile(file: ReceiptUploadFile): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo de comprobante vacío');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('El comprobante no puede superar 5 MB');
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Formato no permitido. Usá JPG, PNG, WEBP o PDF.',
      );
    }
  }

  saveForPayment(
    teamId: number,
    paymentId: number,
    file: ReceiptUploadFile,
  ): { relativePath: string; mimeType: string } {
    this.validateFile(file);
    const mime = file.mimetype.toLowerCase();
    let ext = extname(file.originalname || '').toLowerCase();
    if (!ext || ext.length > 6) {
      ext = EXT_BY_MIME[mime] ?? '.bin';
    }
    const dir = join(this.rootDir, String(teamId));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const filename = `${paymentId}${ext}`;
    const absolutePath = join(dir, filename);
    writeFileSync(absolutePath, file.buffer);
    const relativePath = `payment-receipts/${teamId}/${filename}`;
    return { relativePath, mimeType: mime };
  }

  readAbsolutePath(relativePath: string): { buffer: Buffer; mimeType: string } {
    const absolute = join(process.cwd(), 'uploads', relativePath);
    if (!existsSync(absolute)) {
      throw new BadRequestException('Comprobante no encontrado');
    }
    const buffer = readFileSync(absolute);
    const ext = extname(absolute).toLowerCase();
    const mimeType =
      ext === '.pdf'
        ? 'application/pdf'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/jpeg';
    return { buffer, mimeType };
  }
}
