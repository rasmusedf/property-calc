try {
  if (window.top !== window.self) {
    window.top.location.replace(window.self.location.href)
  }
} catch {
  /* framed and blocked — keep rendering */
}

try {
  var saved = localStorage.getItem('property-calc:lcn:theme')
  var dark =
    saved === 'dark' ||
    (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch {
  document.documentElement.dataset.theme = 'light'
}
