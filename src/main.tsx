import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './i18n';
import App from './App';
import { applyStoredTheme } from './components/ThemeToggle';

applyStoredTheme(); // set theme before first paint to avoid a flash

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
