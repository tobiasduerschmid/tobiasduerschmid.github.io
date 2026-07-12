export function browserSupportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ??
        canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }),
    );
  } catch {
    return false;
  }
}
