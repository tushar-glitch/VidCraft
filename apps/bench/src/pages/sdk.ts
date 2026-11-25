import { createFeed } from '@vidcraft/sdk';
import { installHarness } from '../harness.ts';

const api = new URLSearchParams(location.search).get('api')!;

// Telemetry is off: the benchmark must not add network traffic of its own to the SDK's side.
installHarness({ scroller: '.vc-scroller', mount: (container) => void createFeed(container, { apiUrl: api, pageSize: 10, telemetry: false }) });
