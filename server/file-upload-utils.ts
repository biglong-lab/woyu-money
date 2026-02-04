import multer from "multer";
import path from "path";
import fs from "fs";
import { FileUploadConfig } from "@shared/constants";

export interface UploadConfig {
  destinationDir: string;
  filePrefix: string;
  allowedExtensions: RegExp;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  useMemoryStorage?: boolean;
  errorMessage?: string;
}

export function ensureUploadDirectories(dirs: string[]): void {
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function createFileFilter(
  allowedExtensions: RegExp,
  allowedMimeTypes?: string[],
  errorMessage?: string
): multer.Options['fileFilter'] {
  return (req, file, cb) => {
    const extname = allowedExtensions.test(
      path.extname(file.originalname).toLowerCase()
    );
    
    if (!extname) {
      return cb(new Error(errorMessage || 'Invalid file type'));
    }

    if (allowedMimeTypes && allowedMimeTypes.length > 0) {
      const mimetypeMatch = allowedMimeTypes.some(type => {
        if (type.endsWith('/*')) {
          const baseType = type.slice(0, -2);
          return file.mimetype.startsWith(baseType + '/');
        }
        return file.mimetype === type;
      });

      if (!mimetypeMatch) {
        return cb(new Error(errorMessage || 'Invalid file type'));
      }
    }

    cb(null, true);
  };
}

export function createUploadMiddleware(config: UploadConfig): multer.Multer {
  const storage = config.useMemoryStorage
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, config.destinationDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const filename = `${config.filePrefix}-${uniqueSuffix}${path.extname(file.originalname)}`;
          cb(null, filename);
        }
      });

  return multer({
    storage,
    limits: {
      fileSize: config.maxFileSize || FileUploadConfig.MAX_FILE_SIZE,
    },
    fileFilter: createFileFilter(
      config.allowedExtensions,
      config.allowedMimeTypes,
      config.errorMessage
    ),
  });
}

export const UploadPresets = {
  receipt: (uploadDir: string): multer.Multer => 
    createUploadMiddleware({
      destinationDir: path.join(uploadDir, 'receipts'),
      filePrefix: 'receipt',
      allowedExtensions: /\.(jpeg|jpg|png|gif)$/i,
      allowedMimeTypes: [...FileUploadConfig.ALLOWED_IMAGE_TYPES] as string[],
      errorMessage: 'Invalid file type. Only image files (JPEG, PNG, GIF) are allowed.',
    }),

  contract: (uploadDir: string): multer.Multer => 
    createUploadMiddleware({
      destinationDir: path.join(uploadDir, 'contracts'),
      filePrefix: 'contract',
      allowedExtensions: /\.(jpeg|jpg|png|gif|pdf|xlsx|xls)$/i,
      allowedMimeTypes: [
        ...FileUploadConfig.ALLOWED_IMAGE_TYPES,
        ...FileUploadConfig.ALLOWED_DOCUMENT_TYPES,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ] as string[],
      errorMessage: 'Invalid file type. Only images, PDFs, and Excel files are allowed.',
    }),

  batchImport: (): multer.Multer => 
    createUploadMiddleware({
      destinationDir: '', // Not used for memory storage
      filePrefix: 'import',
      allowedExtensions: /\.(xlsx|xls|csv)$/i,
      allowedMimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'spreadsheet',
        'excel',
      ] as string[],
      maxFileSize: 5 * 1024 * 1024, // 5MB for imports
      useMemoryStorage: true,
      errorMessage: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.',
    }),

  generalFile: (uploadDir: string): multer.Multer => 
    createUploadMiddleware({
      destinationDir: uploadDir,
      filePrefix: 'file',
      allowedExtensions: /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt)$/i,
      allowedMimeTypes: [
        ...FileUploadConfig.ALLOWED_IMAGE_TYPES,
        ...FileUploadConfig.ALLOWED_DOCUMENT_TYPES,
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ] as string[],
      errorMessage: 'Invalid file type. Only images and documents are allowed.',
    }),

  dynamicFile: (uploadDir: string): multer.Multer => {
    const imagesDir = path.join(uploadDir, 'images');
    const documentsDir = path.join(uploadDir, 'documents');
    
    ensureUploadDirectories([imagesDir, documentsDir]);

    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const fileType = file.mimetype.startsWith('image/') ? imagesDir : documentsDir;
          cb(null, fileType);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const prefix = file.mimetype.startsWith('image/') ? 'img' : 'doc';
          cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
      }),
      limits: {
        fileSize: FileUploadConfig.MAX_FILE_SIZE,
      },
      fileFilter: createFileFilter(
        /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt)$/i,
        [
          ...FileUploadConfig.ALLOWED_IMAGE_TYPES,
          ...FileUploadConfig.ALLOWED_DOCUMENT_TYPES,
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ] as string[],
        'Invalid file type. Only images and documents are allowed.'
      ),
    });
  },
};
