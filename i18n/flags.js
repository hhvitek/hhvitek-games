// Flags of the languages in i18n/languages.js as small inline SVGs (Windows draws no emoji flags).
// Every one fills a 3:2 box (viewBox 0 0 30 20, or sliced to it), ids are unique so two flags can share a page.
globalThis.FLAGS = {
  cs: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#d7141a"/><rect width="30" height="10" fill="#fff"/><path d="M0 0 15 10 0 20z" fill="#11457e"/></svg>',
  en: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><clipPath id="flag-uk-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" clip-path="url(#flag-uk-t)" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>',
};
