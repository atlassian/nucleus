import { expect } from 'chai';

import { generateSHAs } from '../sha';

describe('generateSHAs', () => {
  it('should hash the given buffer', () => {
    expect(generateSHAs(Buffer.from('abc'))).to.deep.equal({
      sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
  });

  it('should hash empty buffers', () => {
    expect(generateSHAs(Buffer.alloc(0))).to.deep.equal({
      sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
  });
});
