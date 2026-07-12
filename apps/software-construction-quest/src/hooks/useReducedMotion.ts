import { useEffect, useState } from 'react';

function reducedMotionIsActive() {
  return document.documentElement.classList.contains('prm-reduce') ||
    window.__prefersReducedMotion?.() === true;
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(reducedMotionIsActive);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setReducedMotion(reducedMotionIsActive());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return reducedMotion;
}
