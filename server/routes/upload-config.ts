import multer from "multer"
import path from "path"
import fs from "fs"

// 確保上傳目錄存在
const uploadDir = path.join(process.cwd(), "uploads")
const contractsDir = path.join(uploadDir, "contracts")
const receiptsDir = path.join(uploadDir, "receipts")
const documentsDir = path.join(uploadDir, "documents")
const imagesDir = path.join(uploadDir, "images")
const inboxDir = path.join(uploadDir, "inbox")

export { uploadDir, contractsDir, receiptsDir, documentsDir, imagesDir, inboxDir }
;[uploadDir, contractsDir, receiptsDir, documentsDir, imagesDir, inboxDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// 一般檔案上傳（合約等）
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      cb(null, "contract-" + uniqueSuffix + path.extname(file.originalname))
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimeOk = allowedTypes.test(file.mimetype)
    if (mimeOk && extOk) return cb(null, true)
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed."))
  },
})

// 收據上傳
export const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, receiptsDir)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      cb(null, "receipt-" + uniqueSuffix + path.extname(file.originalname))
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimeOk = allowedTypes.test(file.mimetype)
    if (mimeOk && extOk) return cb(null, true)
    cb(new Error("Invalid file type. Only image files are allowed."))
  },
})

// 批次匯入上傳
export const batchImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /xlsx|xls|csv/
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimeOk =
      file.mimetype.includes("spreadsheet") ||
      file.mimetype.includes("csv") ||
      file.mimetype.includes("excel")
    if (mimeOk || extOk) return cb(null, true)
    cb(new Error("Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed."))
  },
})

// 允許的檔案類型（圖片 + PDF + 文件）
const allowedFileTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xlsx|xls|csv|webp|heic|heif/
function commonFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const extOk = allowedFileTypes.test(path.extname(file.originalname).toLowerCase())
  const mimeOk =
    allowedFileTypes.test(file.mimetype) ||
    file.mimetype.startsWith("image/") ||
    file.mimetype.includes("spreadsheet") ||
    file.mimetype.includes("document")
  if (mimeOk || extOk) return cb(null, true)
  cb(new Error("不支援的檔案格式"))
}

// 一般檔案附件上傳
export const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      cb(null, "file-" + uniqueSuffix + path.extname(file.originalname))
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: commonFileFilter,
})

// 付款憑證上傳
export const paymentFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, receiptsDir)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      cb(null, "payment-" + uniqueSuffix + path.extname(file.originalname))
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: commonFileFilter,
})

// 文件收件箱上傳
export const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, inboxDir)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      const ext = path.extname(file.originalname)
      cb(null, `doc-${uniqueSuffix}${ext}`)
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|heic|heif|webp/
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimeOk = allowedTypes.test(file.mimetype) || file.mimetype.startsWith("image/")
    if (mimeOk || extOk) return cb(null, true)
    cb(new Error("不支援的檔案格式"))
  },
})
