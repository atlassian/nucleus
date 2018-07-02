import * as crypto from 'crypto';

export const generateSHAs = (buffer: Buffer): HashSet => ({
  sha1: crypto.createHash('SHA1').update(buffer).digest('hex'),
  sha256: crypto.createHash('SHA256').update(buffer).digest('hex'),
});
