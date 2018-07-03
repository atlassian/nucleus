import { expect } from 'chai';
import { spy } from 'sinon';

import { runPQ } from '../p-queue';

describe('runPQ', () => {
  it('should run for all items in the item set', async () => {
    const result = await runPQ([1, 2, 3, 4], async (n) => {
      return n + 1;
    });
    expect(result).to.deep.equal([2, 3, 4, 5]);
  });

  it('should return items in the correct order', async () => {
    const result = await runPQ([1, 5, 10, 15, 20, 25, 30], async (n) => {
      return n / 5;
    });
    expect(result).to.deep.equal([0.2, 1, 2, 3, 4, 5, 6]);
  });

  it('should throw an error when simultaneous is set to 0', async () => {
    try {
      await runPQ([1, 2, 3], async n => n + 1, 0);
    } catch (err) {
      expect(err).to.not.equal(null, 'should have thrown an error');
      return;
    }
    expect(0).to.equal(1, 'should have thrown an error');
  });

  it('should exit early when the executor throws', async () => {
    const executor = spy(async (n: number) => {
      if (n === 2) {
        throw 'bad';
      }
      return n;
    });
    try {
      await runPQ([1, 2, 3], executor, 1);
    } catch (err) {
      expect(err).to.equal('bad');
      expect(executor.callCount).to.equal(2);
      return;
    }
    expect(0).to.equal(1, 'should have thrown an error');
  });

  it('should never have more than simultaneous things running', async () => {
    let running = 0;
    await runPQ((Array(1000)).fill(0), async () => {
      running += 1;
      await new Promise(r => setTimeout(r, 1));
      expect(running).to.be.lte(10);
      running -= 1;
    }, 10);
  });
});
