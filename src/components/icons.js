const paths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/>',
  detail: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h7M9 17h7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  alert: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  cursor: '<path d="m5 3 13 8-6 2-2 6Z"/><path d="m12 13 5 6"/>',
  factory: '<path d="M3 21V9l6 3V8l6 4V5h4v16Z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  blocks: '<path d="M4 5h7v7H4zM13 5h7v7h-7zM8.5 14h7v7h-7z"/>',
  assembly: '<path d="M4 21V8h16v13M2 21h20"/><path d="M7 8V4h10v4M8 13h3v4H8zM13 13h3v4h-3z"/>',
  crane: '<path d="M4 21h16M8 21V4h9M8 8h12M17 4v12"/><path d="M17 12h3v4h-3z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  ship: '<path d="M3 16h18l-3 4H6zM7 16V9h10v7M10 9V5h4v4"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  reset: '<path d="M4 4v6h6M20 20v-6h-6"/><path d="M5.5 15a8 8 0 0 0 13-6M18.5 9A8 8 0 0 0 5.5 9"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  collapse: '<path d="M8 8H3V3M16 8h5V3M8 16H3v5M16 16h5v5"/>',
  external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/><path d="M9 12h11"/>',
};

export function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
}
