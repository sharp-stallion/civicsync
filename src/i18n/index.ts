import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Vernacular support: English / Tamil / Hindi. UI labels only — never user
// content (reports, demands) which stay in whatever language they were written.
// Dictionaries are small and inline (one chunk, well under 20 KB) so there is
// no extra network request on Vercel's edge.

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

const en = {
  brand: { tagline: 'South Chennai' },
  lang: { label: 'Language' },
  nav: {
    dashboard: 'Dashboard', projects: 'Projects', digonce: 'Dig-Once', forum: 'Demand board',
    myarea: 'My area', scoreboard: 'Scoreboard', report: 'Report an issue', myreports: 'My reports',
    inbox: 'Reports inbox', register: 'Register project', approvals: 'Approvals',
  },
  common: { signin: 'Sign in', signout: 'Sign out', refresh: 'Refresh', loading: 'Loading…', pending: 'awaiting approval' },
  dash: {
    eyebrow: 'Public works, in sync', title: 'South Chennai, working together',
    subtitle: 'Every registered dig, its purpose, timeline and the department responsible — in one place, with coordination before the road is cut twice.',
    total: 'Registered works', active: 'Active now', reports: 'Open reports', coordination: 'Coordination needed',
  },
  forum: {
    eyebrow: 'Citizen demand board', title: 'What South Chennai wants fixed',
    subtitle: 'Residents raise an issue with a clear end goal. Others upvote. The loudest, most-supported demands rise to the top — and officials can turn them into real projects.',
    raise: 'Raise a demand', mostSupported: 'Most supported', newest: 'Newest', goal: 'Goal', allAreas: 'All areas',
    capReached: 'Daily limit reached — you can raise 2 demands per day. Try again tomorrow.',
    capLeft: '{{n}} of 2 demands left today.',
  },
};

const ta: typeof en = {
  brand: { tagline: 'தென் சென்னை' },
  lang: { label: 'மொழி' },
  nav: {
    dashboard: 'முகப்பு', projects: 'திட்டங்கள்', digonce: 'Dig-Once', forum: 'கோரிக்கை பலகை',
    myarea: 'என் பகுதி', scoreboard: 'மதிப்பெண் பலகை', report: 'புகார் அளி', myreports: 'என் புகார்கள்',
    inbox: 'புகார் பெட்டி', register: 'திட்டம் பதிவு', approvals: 'ஒப்புதல்கள்',
  },
  common: { signin: 'உள்நுழை', signout: 'வெளியேறு', refresh: 'புதுப்பி', loading: 'ஏற்றுகிறது…', pending: 'ஒப்புதலுக்காக காத்திருக்கிறது' },
  dash: {
    eyebrow: 'பொதுப்பணிகள், ஒருங்கிணைவாக', title: 'தென் சென்னை, இணைந்து செயல்படுகிறது',
    subtitle: 'பதிவு செய்யப்பட்ட ஒவ்வொரு பணி, அதன் நோக்கம், கால அட்டவணை மற்றும் பொறுப்பான துறை — ஒரே இடத்தில், சாலை இருமுறை தோண்டப்படுவதற்கு முன் ஒருங்கிணைப்புடன்.',
    total: 'பதிவு செய்யப்பட்ட பணிகள்', active: 'தற்போது செயலில்', reports: 'திறந்த புகார்கள்', coordination: 'ஒருங்கிணைப்பு தேவை',
  },
  forum: {
    eyebrow: 'குடிமக்கள் கோரிக்கை பலகை', title: 'தென் சென்னை சரிசெய்ய விரும்புவது',
    subtitle: 'குடிமக்கள் தெளிவான இலக்குடன் ஒரு பிரச்சினையை எழுப்புகிறார்கள். மற்றவர்கள் ஆதரவு அளிக்கிறார்கள். அதிக ஆதரவு பெற்றவை மேலே வருகின்றன — அதிகாரிகள் அவற்றை உண்மையான திட்டங்களாக மாற்றலாம்.',
    raise: 'கோரிக்கை பதிவு', mostSupported: 'அதிக ஆதரவு', newest: 'புதியவை', goal: 'இலக்கு', allAreas: 'அனைத்து பகுதிகள்',
    capReached: 'தினசரி வரம்பை அடைந்தீர்கள் — ஒரு நாளைக்கு 2 கோரிக்கைகள். நாளை முயற்சிக்கவும்.',
    capLeft: 'இன்று {{n}} / 2 கோரிக்கைகள் மீதம்.',
  },
};

const hi: typeof en = {
  brand: { tagline: 'दक्षिण चेन्नई' },
  lang: { label: 'भाषा' },
  nav: {
    dashboard: 'डैशबोर्ड', projects: 'परियोजनाएँ', digonce: 'Dig-Once', forum: 'मांग बोर्ड',
    myarea: 'मेरा क्षेत्र', scoreboard: 'स्कोरबोर्ड', report: 'शिकायत दर्ज करें', myreports: 'मेरी शिकायतें',
    inbox: 'शिकायत इनबॉक्स', register: 'परियोजना पंजीकरण', approvals: 'अनुमोदन',
  },
  common: { signin: 'साइन इन', signout: 'साइन आउट', refresh: 'रिफ्रेश', loading: 'लोड हो रहा है…', pending: 'अनुमोदन की प्रतीक्षा' },
  dash: {
    eyebrow: 'सार्वजनिक कार्य, समन्वय में', title: 'दक्षिण चेन्नई, मिलकर काम करते हुए',
    subtitle: 'हर पंजीकृत खुदाई, उसका उद्देश्य, समय-सीमा और ज़िम्मेदार विभाग — एक ही जगह, सड़क दोबारा खोदे जाने से पहले समन्वय के साथ।',
    total: 'पंजीकृत कार्य', active: 'अभी सक्रिय', reports: 'खुली शिकायतें', coordination: 'समन्वय आवश्यक',
  },
  forum: {
    eyebrow: 'नागरिक मांग बोर्ड', title: 'दक्षिण चेन्नई क्या ठीक कराना चाहता है',
    subtitle: 'निवासी एक स्पष्ट लक्ष्य के साथ मुद्दा उठाते हैं। अन्य लोग समर्थन देते हैं। सबसे ज़्यादा समर्थित मांगें ऊपर आती हैं — और अधिकारी उन्हें असली परियोजनाओं में बदल सकते हैं।',
    raise: 'मांग उठाएँ', mostSupported: 'सबसे समर्थित', newest: 'नवीनतम', goal: 'लक्ष्य', allAreas: 'सभी क्षेत्र',
    capReached: 'दैनिक सीमा पूरी — आप प्रति दिन 2 मांगें उठा सकते हैं। कल पुनः प्रयास करें।',
    capLeft: 'आज {{n}} / 2 मांगें शेष।',
  },
};

const stored = (() => { try { return localStorage.getItem('cs:lang') ?? 'en'; } catch { return 'en'; } })();

i18n.use(initReactI18next).init({
  resources: { en: { t: en }, ta: { t: ta }, hi: { t: hi } },
  lng: stored,
  fallbackLng: 'en',
  defaultNS: 't',
  interpolation: { escapeValue: false },
});

export function setLanguage(code: string) {
  i18n.changeLanguage(code);
  try { localStorage.setItem('cs:lang', code); } catch { /* ignore */ }
}

export default i18n;
