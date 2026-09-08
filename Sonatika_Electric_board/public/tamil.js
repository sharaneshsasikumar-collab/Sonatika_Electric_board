'use strict';

const languageKey = 'sonatika-language';
const tamilMode = localStorage.getItem(languageKey) === 'ta';

function localizeLanding() {
  const root = document.querySelector('.landing');
  if (!root || !tamilMode || root.dataset.localized === 'true') return;
  root.dataset.localized = 'true';
  root.classList.add('landing-tamil');
  document.documentElement.lang = 'ta';
  document.title = 'சோனாடிகா மின்சார வாரியம்';

  const set = (selector, text) => {
    const element = root.querySelector(selector);
    if (element) element.textContent = text;
  };

  const brand = root.querySelector('.landing-brand > span');
  if (brand) brand.innerHTML = '<strong>சோனாடிகா மின்சார<br>வாரியம்</strong>';

  set('[data-language]', 'ஆங்கிலம்');
  set('.landing-actions [data-enter]', 'குடிமக்கள் உள்நுழைவு');
  set('.grid-status', '●  தேசிய ஒருங்கிணைந்த ஸ்மார்ட் கிரிட்');

  const title = root.querySelector('.hero-card h1');
  if (title) title.innerHTML = 'சோனாடிகாவின்<br>எதிர்காலத்தை<br>இயக்குகிறோம்';

  const intro = root.querySelector('.hero-card p');
  if (intro) intro.innerHTML = 'உலகம் சாத்தியமில்லையென நினைத்ததையும் சாதிக்கும் நாடு இது. உலக சமூகத்தின் பாராட்டுக்காக அல்ல; அதன் அழகிய மக்களுக்காக.<br>– அதுதான் சோனாடிகா.';

  set('.hero-cta [data-enter]', 'எனது பில்லைக் காண்க');
  set('.hero-cta [data-scroll-services]', 'பசுமை ஆற்றலை ஆராய்க');

  const badge = root.querySelector('.vision-badge');
  if (badge) {
    badge.src = '/assets/vision-2029-tamil.png';
    badge.alt = 'விஷன் 2029 சோனாடிகா';
  }

  set('.services .script-title', 'ஊடாடும் சேவைகள்');
  set('.services > .muted', 'உங்கள் விரல் நுனியில் அதிநவீன மின் பயன்பாடுகள்.');

  const cards = [
    ['விரைவான பில் செலுத்துதல்', 'பாதுகாப்பான ஒருங்கிணைந்த கட்டண முறையில் உங்கள் மின்சாரக் கட்டணத்தை உடனே பார்த்துச் செலுத்துங்கள்.', 'செலுத்தத் தொடங்கவும் →'],
    ['நிகழ்நேர நுகர்வு', 'மின்சாரப் பயன்பாட்டைச் சீராக்க உங்கள் ஸ்மார்ட் மீட்டரின் நேரடி அளவீடுகளைக் கண்காணியுங்கள்.', 'கண்காணிப்பைத் தொடங்குக →'],
    ['பசுமை தடம்', 'உங்கள் இல்லத்திற்கு கிடைக்கும் காற்று, சூரிய மற்றும் அலை ஆற்றலின் சதவீதத்தைக் காணுங்கள்.', 'புதுப்பிக்கத்தக்கதை கண்காணி →'],
    ['ஸ்மார்ட் மீட்டர் ஒருங்கிணைப்பு', 'துல்லியமான ஆய்வு, பயன்பாட்டு எச்சரிக்கைகள் மற்றும் வீட்டு மின்கல மேலாண்மையை இயக்குங்கள்.', 'மீட்டரைப் பதிவு செய்க →']
  ];

  root.querySelectorAll('.service-card').forEach((card, index) => {
    const content = cards[index];
    if (!content) return;
    card.querySelector('h3').textContent = content[0];
    card.querySelector('p').textContent = content[1];
    card.querySelector('button').textContent = content[2];
  });

  set('.mission h2', 'சோனாடிகா தேசிய பசுமை ஆற்றல் இயக்கம்');
  set('.mission h3', 'இன்றை இயக்கும். நாளைப் பாதுகாக்கும்.');
  set('.mission p', '2030 ஆம் ஆண்டிற்குள் 100% மாசு உமிழ்வற்ற மின்சார விநியோகத்தை அடையும் மாபெரும் தேசிய உறுதி. நமது முன்னேற்றத்தை தேசியப் பதிவேட்டில் நேரலையாகக் காணுங்கள்.');
  set('.mission .btn', 'இயக்கத் தரவுகளை ஆராய்க');
  set('.landing-footer strong', 'எரிசக்தி மற்றும் ஸ்மார்ட் கிரிட் அமைச்சகம்');
  set('.landing-footer small', 'சோனாடிகா குடியரசின் பொதுச் சேவை தளம்');
  set('.landing-footer > span', '© 2026 சோனாடிகா மின்சார வாரியம். பாதுகாப்பான இறையாண்மை குடிமக்கள் சேவை.');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-language]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  localStorage.setItem(languageKey, tamilMode ? 'en' : 'ta');
  location.reload();
}, true);

new MutationObserver(localizeLanding).observe(document.querySelector('#app'), { childList: true });
localizeLanding();
