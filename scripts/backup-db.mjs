import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  computeSha256Hex,
  dispatchBackupAlert,
  encryptBufferAes256Gcm,
  gzipCompress,
  S3CompatibleStorage,
  selectGfsRetentionKeys,
} from './backup-lib.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

function getBackupStamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

function createStorageClientFromEnv() {
  const endpoint = process.env.BACKUP_S3_ENDPOINT?.trim();
  const bucket = process.env.BACKUP_S3_BUCKET?.trim();
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3CompatibleStorage({
    endpoint,
    region: process.env.BACKUP_S3_REGION?.trim() || 'auto',
    bucket,
    accessKeyId,
    secretAccessKey,
  });
}

async function runBackup() {
  const args = parseArgs(process.argv.slice(2));
  const localDir = path.resolve(
    process.cwd(),
    String(args['out-dir'] || process.env.BACKUP_LOCAL_DIR || 'backups')
  );
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  const prefix = String(process.env.BACKUP_S3_PREFIX || 'lakzee-backups').replace(/^\/+|\/+$/g, '');

  fs.mkdirSync(localDir, { recursive: true });

  let rawSqlBuffer;
  if (typeof args['input-sql'] === 'string') {
    rawSqlBuffer = fs.readFileSync(path.resolve(process.cwd(), args['input-sql']));
  } else {
    const dbUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').trim();
    if (!dbUrl) {
      throw new Error('DIRECT_URL or DATABASE_URL must be configured to execute pg_dump.');
    }
    rawSqlBuffer = execFileSync(
      'pg_dump',
      [dbUrl, '--format=plain', '--no-owner', '--no-privileges'],
      { maxBuffer: 256 * 1024 * 1024 }
    );
  }

  if (!rawSqlBuffer || rawSqlBuffer.length === 0) {
    throw new Error('Database dump returned 0 bytes; aborting encrypted backup.');
  }

  const stamp = getBackupStamp();
  const baseName = `lakzee-backup-${stamp}`;
  const compressed = gzipCompress(rawSqlBuffer);
  const encrypted = encryptBufferAes256Gcm(compressed, encryptionKey);
  const encryptedSha256 = computeSha256Hex(encrypted);
  const gzipSha256 = computeSha256Hex(compressed);

  const encFileName = `${baseName}.sql.gz.enc`;
  const shaFileName = `${baseName}.sql.gz.enc.sha256`;
  const manifestName = `${baseName}.manifest.json`;

  const encFilePath = path.join(localDir, encFileName);
  const shaFilePath = path.join(localDir, shaFileName);
  const manifestPath = path.join(localDir, manifestName);

  const manifest = {
    version: 1,
    file: encFileName,
    createdAt: new Date().toISOString(),
    rawSqlBytes: rawSqlBuffer.length,
    gzipBytes: compressed.length,
    encryptedBytes: encrypted.length,
    gzipSha256,
    encryptedSha256,
    encryption: 'AES-256-GCM',
    compression: 'gzip-level-9',
    retentionPolicy: { daily: 7, weekly: 4, monthly: 12 },
  };

  fs.writeFileSync(encFilePath, encrypted);
  fs.writeFileSync(shaFilePath, `${encryptedSha256}  ${encFileName}\n`, 'utf8');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const s3 = createStorageClientFromEnv();
  let remoteUploaded = false;
  let remotePruned = [];

  if (s3) {
    await s3.putObject(`${prefix}/${encFileName}`, encrypted, 'application/octet-stream');
    await s3.putObject(`${prefix}/${shaFileName}`, Buffer.from(`${encryptedSha256}  ${encFileName}\n`, 'utf8'), 'text/plain');
    await s3.putObject(`${prefix}/${manifestName}`, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), 'application/json');
    remoteUploaded = true;

    const allRemoteKeys = await s3.listObjects(`${prefix}/`);
    const remoteEncKeys = allRemoteKeys.filter((k) => k.endsWith('.sql.gz.enc'));
    const remoteRetention = selectGfsRetentionKeys(remoteEncKeys);
    for (const expiredKey of remoteRetention.prune) {
      await s3.deleteObject(expiredKey).catch(() => undefined);
      await s3.deleteObject(`${expiredKey}.sha256`).catch(() => undefined);
      await s3.deleteObject(expiredKey.replace(/\.sql\.gz\.enc$/, '.manifest.json')).catch(() => undefined);
      remotePruned.push(expiredKey);
    }
  }

  // Apply GFS retention pruning on local snapshots directory
  const localEncFiles = fs
    .readdirSync(localDir)
    .filter((f) => f.endsWith('.sql.gz.enc'))
    .map((f) => ({ key: f, createdAt: fs.statSync(path.join(localDir, f)).mtime }));

  const localRetention = selectGfsRetentionKeys(localEncFiles);
  for (const expiredFile of localRetention.prune) {
    fs.rmSync(path.join(localDir, expiredFile), { force: true });
    fs.rmSync(path.join(localDir, `${expiredFile}.sha256`), { force: true });
    fs.rmSync(path.join(localDir, expiredFile.replace(/\.sql\.gz\.enc$/, '.manifest.json')), {
      force: true,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        file: encFilePath,
        sha256File: shaFilePath,
        encryptedSha256,
        rawSqlBytes: rawSqlBuffer.length,
        encryptedBytes: encrypted.length,
        remoteUploaded,
        remotePrunedCount: remotePruned.length,
        localKeptCount: localRetention.keep.length,
        localPrunedCount: localRetention.prune.length,
      },
      null,
      2
    )}\n`
  );
}

runBackup().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Backup FAILED: ${message}\n`);
  await dispatchBackupAlert({
    rule: 'BACKUP_FAILED',
    severity: 'critical',
    message,
  });
  process.exit(1);
});
