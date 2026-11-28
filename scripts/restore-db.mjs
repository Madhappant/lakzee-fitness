import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  computeSha256Hex,
  decryptBufferAes256Gcm,
  gzipDecompress,
  parseBackupTimestamp,
  S3CompatibleStorage,
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

function maskDbUrl(rawUrl) {
  if (!rawUrl) return 'not-configured';
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//***:***@${u.host}${u.pathname}`;
  } catch {
    return '***';
  }
}

function extractSqlTablesSummary(sqlText) {
  const tables = new Set();
  const regex = /\b(?:CREATE TABLE|INSERT INTO|COPY)\s+(?:IF NOT EXISTS\s+)?(?:"public"\.|public\.)?"?([A-Za-z0-9_]+)"?/gi;
  let match;
  while ((match = regex.exec(sqlText)) !== null) {
    tables.add(match[1]);
  }
  return Array.from(tables);
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

async function runRestore() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);
  const confirmRestore = Boolean(args['confirm-restore']);
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  const localDir = path.resolve(
    process.cwd(),
    String(args['backup-dir'] || process.env.BACKUP_LOCAL_DIR || 'backups')
  );
  const prefix = String(process.env.BACKUP_S3_PREFIX || 'lakzee-backups').replace(/^\/+|\/+$/g, '');

  let encryptedBuffer;
  let expectedSha256 = typeof args['expected-sha256'] === 'string' ? args['expected-sha256'].trim().toLowerCase() : null;
  let sourceLabel = '';

  if (typeof args.file === 'string') {
    const filePath = path.resolve(process.cwd(), args.file);
    encryptedBuffer = fs.readFileSync(filePath);
    sourceLabel = filePath;
    if (!expectedSha256 && fs.existsSync(`${filePath}.sha256`)) {
      expectedSha256 = fs.readFileSync(`${filePath}.sha256`, 'utf8').trim().split(/\s+/)[0].toLowerCase();
    }
  } else if (typeof args['remote-key'] === 'string' || args.latest) {
    const s3 = createStorageClientFromEnv();
    if (s3 && (typeof args['remote-key'] === 'string' || !fs.existsSync(localDir))) {
      let targetKey = typeof args['remote-key'] === 'string' ? args['remote-key'] : null;
      if (!targetKey) {
        const allKeys = (await s3.listObjects(`${prefix}/`)).filter((k) => k.endsWith('.sql.gz.enc'));
        allKeys.sort((a, b) => {
          const da = parseBackupTimestamp(a)?.getTime() ?? 0;
          const db = parseBackupTimestamp(b)?.getTime() ?? 0;
          return db - da;
        });
        targetKey = allKeys[0];
      }
      if (!targetKey) throw new Error('No remote encrypted backups found in object storage.');
      encryptedBuffer = await s3.getObjectBuffer(targetKey);
      sourceLabel = `s3://${s3.bucket}/${targetKey}`;
      if (!expectedSha256) {
        const shaRaw = await s3.getObjectBuffer(`${targetKey}.sha256`).catch(() => null);
        if (shaRaw) {
          expectedSha256 = shaRaw.toString('utf8').trim().split(/\s+/)[0].toLowerCase();
        }
      }
    } else {
      const files = fs
        .readdirSync(localDir)
        .filter((f) => f.endsWith('.sql.gz.enc'))
        .sort()
        .reverse();
      if (files.length === 0) {
        throw new Error(`No encrypted snapshots found in ${localDir}.`);
      }
      const latestPath = path.join(localDir, files[0]);
      encryptedBuffer = fs.readFileSync(latestPath);
      sourceLabel = latestPath;
      if (!expectedSha256 && fs.existsSync(`${latestPath}.sha256`)) {
        expectedSha256 = fs.readFileSync(`${latestPath}.sha256`, 'utf8').trim().split(/\s+/)[0].toLowerCase();
      }
    }
  } else {
    throw new Error('Specify --file <path.sql.gz.enc>, --remote-key <key>, or --latest.');
  }

  if (!expectedSha256) {
    throw new Error('Missing SHA-256 checksum sidecar or --expected-sha256 parameter. Refusing unverified restore.');
  }

  const actualSha256 = computeSha256Hex(encryptedBuffer);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`SHA-256 checksum mismatch! Expected ${expectedSha256}, got ${actualSha256}`);
  }

  const compressedBuffer = decryptBufferAes256Gcm(encryptedBuffer, encryptionKey);
  const sqlBuffer = gzipDecompress(compressedBuffer);
  const sqlText = sqlBuffer.toString('utf8');
  if (!sqlText.trim()) {
    throw new Error('Decrypted SQL payload is empty.');
  }

  const tablesDetected = extractSqlTablesSummary(sqlText);
  const targetDbUrl = (
    (typeof args['target-url'] === 'string' && args['target-url']) ||
    process.env.RESTORE_TARGET_URL ||
    process.env.STAGING_DIRECT_URL ||
    process.env.DIRECT_URL ||
    ''
  ).trim();

  if (dryRun) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          dryRun: true,
          source: sourceLabel,
          sha256Verified: true,
          encryptedSha256: actualSha256,
          encryptedBytes: encryptedBuffer.length,
          gzipBytes: compressedBuffer.length,
          uncompressedSqlBytes: sqlBuffer.length,
          tablesDetected,
          targetDatabase: maskDbUrl(targetDbUrl),
        },
        null,
        2
      )}\n`
    );
    return;
  }

  if (!targetDbUrl) {
    throw new Error('Live restore requires --target-url, STAGING_DIRECT_URL, or DIRECT_URL.');
  }

  if (!confirmRestore) {
    throw new Error(
      'Safety guard triggered: live database restore blocked without explicit --confirm-restore flag. Run with --dry-run first.'
    );
  }

  // Additional production hostname guard when targeting non-local PostgreSQL clusters
  const parsedTarget = new URL(targetDbUrl);
  const dbName = parsedTarget.pathname.replace(/^\/+/, '');
  const isRemoteHost = !['127.0.0.1', 'localhost'].includes(parsedTarget.hostname);
  if (isRemoteHost && String(args['target-db-name'] || '') !== dbName) {
    throw new Error(
      `Production confirmation guard: restoring onto remote host ${parsedTarget.hostname} requires --target-db-name ${dbName}.`
    );
  }

  const tmpSqlFile = path.join(os.tmpdir(), `lakzee-restore-${Date.now()}.sql`);
  try {
    fs.writeFileSync(tmpSqlFile, sqlBuffer, { mode: 0o600 });
    execFileSync(
      'psql',
      [targetDbUrl, '--set', 'ON_ERROR_STOP=1', '--single-transaction', '--file', tmpSqlFile],
      { stdio: 'pipe' }
    );
  } finally {
    fs.rmSync(tmpSqlFile, { force: true });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        dryRun: false,
        restored: true,
        source: sourceLabel,
        sha256Verified: true,
        tablesDetected,
        targetDatabase: maskDbUrl(targetDbUrl),
      },
      null,
      2
    )}\n`
  );
}

runRestore().catch((err) => {
  process.stderr.write(`Restore FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
