import { describe, it } from 'node:test';
import assert from 'node:assert';

import { normalizeRoute, detectKind, renderIngress, applyIngressToConfig } from '../src/api/routes.js';
import { getVersion } from '../src/utils/paths.js';

describe('Route normalization', () => {
  it('should derive a slug id from the hostname', () => {
    const r = normalizeRoute({ hostname: 'app.example.com', origin: 'http://127.0.0.1:3000' });
    assert.strictEqual(r.id, 'app');
    assert.strictEqual(r.hostname, 'app.example.com');
    assert.strictEqual(r.publicUrl, 'https://app.example.com');
    assert.strictEqual(r.enabled, true);
  });

  it('should lowercase hostname and strip a trailing slash from origin', () => {
    const r = normalizeRoute({ hostname: 'APP.Example.com', origin: 'http://127.0.0.1:3000/' });
    assert.strictEqual(r.hostname, 'app.example.com');
    assert.strictEqual(r.origin, 'http://127.0.0.1:3000');
  });

  it('should default enabled to true but honour explicit false', () => {
    assert.strictEqual(normalizeRoute({ hostname: 'a.example.com', origin: 'http://x:1' }).enabled, true);
    assert.strictEqual(
      normalizeRoute({ hostname: 'a.example.com', origin: 'http://x:1', enabled: false }).enabled,
      false
    );
  });

  it('should classify the internal server origin as internal', () => {
    // default config server is http://127.0.0.1:8787
    assert.strictEqual(detectKind('http://127.0.0.1:8787'), 'internal');
    assert.strictEqual(detectKind('http://127.0.0.1:9999'), 'external');
    assert.strictEqual(detectKind('not a url'), 'external');
  });
});

describe('Version reporting', () => {
  it('should report a non-empty version string', () => {
    const v = getVersion();
    assert.strictEqual(typeof v, 'string');
    assert.ok(v.length > 0);
  });
});

describe('Ingress rendering', () => {
  const routes = [
    { hostname: 'app.example.com', origin: 'http://127.0.0.1:3000', enabled: true },
    { hostname: 'off.example.com', origin: 'http://127.0.0.1:4000', enabled: false },
    { hostname: 'api.example.com', origin: 'http://127.0.0.1:5000', enabled: true }
  ];

  it('should include only enabled routes and always end with the 404 service', () => {
    const { text, hostnames } = renderIngress(routes);
    assert.deepStrictEqual(hostnames, ['app.example.com', 'api.example.com']);
    assert.ok(text.startsWith('ingress:'));
    assert.ok(text.includes('  - hostname: app.example.com\n    service: http://127.0.0.1:3000'));
    assert.ok(!text.includes('off.example.com'));
    assert.ok(text.trimEnd().endsWith('- service: http_status:404'));
  });

  it('should replace an existing ingress block and keep the tunnel header', () => {
    const base = 'tunnel: abc\ncredentials-file: abc.json\n\ningress:\n  - service: http_status:404\n';
    const { text: ingress } = renderIngress(routes);
    const out = applyIngressToConfig(base, ingress);
    assert.ok(out.includes('tunnel: abc'));
    assert.ok(out.includes('credentials-file: abc.json'));
    assert.ok(out.includes('hostname: app.example.com'));
    assert.strictEqual((out.match(/ingress:/g) || []).length, 1);
    assert.ok(out.trimEnd().endsWith('- service: http_status:404'));
  });

  it('should append an ingress block when none exists', () => {
    const base = 'tunnel: abc\ncredentials-file: abc.json\n';
    const { text: ingress } = renderIngress(routes);
    const out = applyIngressToConfig(base, ingress);
    assert.ok(out.includes('ingress:'));
    assert.ok(out.includes('hostname: api.example.com'));
    assert.strictEqual((out.match(/ingress:/g) || []).length, 1);
  });
});
