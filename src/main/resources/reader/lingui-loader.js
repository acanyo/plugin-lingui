(() => {
  const source = document.currentScript;
  if (!(source instanceof HTMLScriptElement)) return;
  if (customElements.get('lingui-component')) return;
  // A page may include both Halo's head loader and several copied component snippets.
  if (document.querySelector('script[data-lingui-loader-active]')) return;
  source.setAttribute('data-lingui-loader-active', '');
  const url = new URL('lingui-reader.js', source.src);
  url.search = new URL(source.src).search;
  let observer;
  function load() {
    if (!document.querySelector('lingui-component[data-lingui]')) return;
    observer?.disconnect();
    if (customElements.get('lingui-component')) return;
    const present = Array.from(document.scripts).some((script) => {
      if (!script.src) return false;
      const existing = new URL(script.src, document.baseURI);
      return existing.origin === url.origin && existing.pathname === url.pathname;
    });
    if (present) return;
    const script = document.createElement('script');
    script.src = url.href;
    script.defer = true;
    script.addEventListener('error', () => {
      script.remove();
      source.removeAttribute('data-lingui-loader-active');
    }, { once: true });
    document.head.append(script);
  }
  if (document.querySelector('lingui-component[data-lingui]')) load();
  else {
    // Theme widgets can be inserted later by partial navigation or client-side rendering.
    observer = new MutationObserver(load);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-lingui'],
    });
  }
})();
