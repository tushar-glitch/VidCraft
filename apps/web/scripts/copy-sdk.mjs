// Copies the built SDK into the site, so the <script src=".../sdk/vidcraft.js"> in the docs works.
import { cp, mkdir } from 'node:fs/promises';

await mkdir(new URL('../public/sdk/', import.meta.url), { recursive: true });
await cp(new URL('../../../packages/sdk/dist/vidcraft.iife.js', import.meta.url), new URL('../public/sdk/vidcraft.js', import.meta.url));
console.log('SDK copied to apps/web/public/sdk/vidcraft.js');
