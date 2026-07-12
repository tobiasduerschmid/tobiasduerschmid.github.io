import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../css/software-construction-quest.css';
import { App } from './App';

const rootElement = document.getElementById('software-construction-quest-root');

if (!rootElement) {
  throw new Error('The Software Construction Quest mount point is missing.');
}

createRoot(rootElement, {
  identifierPrefix: 'software-construction-quest-',
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
