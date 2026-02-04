import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// 本地檔案儲存根目錄
const STORAGE_ROOT = path.resolve(process.cwd(), "uploads");

// 確保儲存目錄存在
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {
    ensureDir(STORAGE_ROOT);
    ensureDir(path.join(STORAGE_ROOT, "inbox"));
  }

  async downloadObject(filePath: string, res: Response, _cacheTtlSec: number = 3600) {
    try {
      const fullPath = this.resolveLocalPath(filePath);
      if (!fs.existsSync(fullPath)) {
        throw new ObjectNotFoundError();
      }

      const stat = fs.statSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      res.set({
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Content-Length": String(stat.size),
        "Cache-Control": "private, max-age=3600",
      });

      const stream = fs.createReadStream(fullPath);
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) throw error;
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async uploadBuffer(buffer: Buffer, filename: string, _contentType: string): Promise<string> {
    const objectId = `${Date.now()}-${randomUUID()}`;
    const ext = filename.split('.').pop() || 'png';
    const objectName = `inbox/${objectId}.${ext}`;
    const fullPath = path.join(STORAGE_ROOT, objectName);

    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, buffer);

    return `/objects/${objectName}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const relativePath = objectPath.replace("/objects/", "");
    const fullPath = path.join(STORAGE_ROOT, relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new ObjectNotFoundError();
    }

    return fullPath;
  }

  async getFileBuffer(objectPath: string): Promise<Buffer> {
    const fullPath = await this.getObjectEntityFile(objectPath);
    return fs.readFileSync(fullPath);
  }

  private resolveLocalPath(filePath: string): string {
    if (filePath.startsWith("/objects/")) {
      return path.join(STORAGE_ROOT, filePath.replace("/objects/", ""));
    }
    return path.join(STORAGE_ROOT, filePath);
  }
}
