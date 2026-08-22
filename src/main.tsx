import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { watchFrame } from './lib/frame.ts';
import './styles.css';

// Before the first render: the frame's height decides where the navigation bar
// sits, and iOS does not always lay out against the whole screen.
watchFrame();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
