import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Ensure uploads directory exists for local fallback
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let storage: multer.StorageEngine;

if (process.env.CLOUDINARY_URL) {
  // Use Cloudinary if configured
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'lakzee_profiles',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    } as any,
  });
} else {
  // Fallback to local disk storage
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
}

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload an image.'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter
});
