import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMobileAuthDualModeEnabled } from './mobileAuthConfig';

describe('mobileAuthConfig', () => {
  it('dual mode activo por defecto', () => {
    const prev = process.env.MOBILE_AUTH_DUAL_MODE;
    delete process.env.MOBILE_AUTH_DUAL_MODE;
    assert.equal(isMobileAuthDualModeEnabled(), true);
    process.env.MOBILE_AUTH_DUAL_MODE = 'false';
    assert.equal(isMobileAuthDualModeEnabled(), false);
    if (prev === undefined) {
      delete process.env.MOBILE_AUTH_DUAL_MODE;
    } else {
      process.env.MOBILE_AUTH_DUAL_MODE = prev;
    }
  });
});
