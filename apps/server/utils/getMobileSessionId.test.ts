import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMobileSessionId } from './getMobileSessionId';

describe('getMobileSessionId', () => {
  it('usa sessionId legacy cuando existe', () => {
    assert.equal(
      getMobileSessionId({ id: 1, cedula: '105', sessionId: 'uuid-1', tokenType: 'legacy' }),
      'uuid-1',
    );
  });

  it('usa username Planillas como sessionId', () => {
    assert.equal(
      getMobileSessionId({ id: 1, cedula: '105', username: '105540231', tokenType: 'planillas' }),
      '105540231',
    );
  });

  it('cae a cedula o id', () => {
    assert.equal(getMobileSessionId({ id: 99, cedula: '105', tokenType: 'planillas' }), '105');
    assert.equal(getMobileSessionId({ id: 99, cedula: null, tokenType: 'planillas' }), '99');
  });
});
