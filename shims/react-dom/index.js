// File: shims/react-dom/index.js (NY FIL i projektets rot)
// =============================
// Minimal shim för RN – uppfyller import { flushSync } from 'react-dom'
exports.flushSync = function flushSync(fn) {
  if (typeof fn === 'function') return fn();
};
exports.default = { flushSync: exports.flushSync };