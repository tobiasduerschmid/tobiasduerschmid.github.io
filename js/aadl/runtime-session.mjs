import { openBrowserJvm } from '../browser-jvm/session.mjs';
import { ARTIFACTS } from './runtime-manifest.mjs';

export function openRuntimeSession(options) {
  return openBrowserJvm({
    ...options, artifacts: ARTIFACTS, moduleURL: import.meta.url,
    frameURL: new URL('../../aadl-runtime-frame.html', import.meta.url),
    label: 'AADL', connectType: 'sebook-aadl-connect',
  });
}
