import { useTranslation } from 'react-i18next';
import { LANGS, setLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={i18n.resolvedLanguage === l.code ? 'on' : ''}
          onClick={() => setLanguage(l.code)}
          aria-pressed={i18n.resolvedLanguage === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
