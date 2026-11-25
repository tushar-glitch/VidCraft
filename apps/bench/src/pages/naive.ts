import { installHarness } from '../harness.ts';
import { mountNaiveFeed } from '../naive-feed.ts';

const api = new URLSearchParams(location.search).get('api')!;

installHarness({ scroller: '.naive-scroller', mount: (container) => void mountNaiveFeed(container, api) });
