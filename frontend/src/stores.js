// Best-effort search URLs for each store's website. These sites change their
// URL structure periodically, so double check these still work and adjust
// as needed.
export const STORES = [
  {
    key: 'BLINKIT',
    label: 'Blinkit',
    color: '#f8cb46',
    searchUrl: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  },
  {
    key: 'ZEPTO',
    label: 'Zepto',
    color: '#7b2ff7',
    searchUrl: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    key: 'INSTAMART',
    label: 'Instamart',
    color: '#fc8019',
    searchUrl: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}`,
  },
  {
    key: 'BIGBASKET',
    label: 'BigBasket',
    color: '#84c225',
    searchUrl: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`,
  },
  {
    key: 'OTHER',
    label: 'Other',
    color: '#94a3b8',
    searchUrl: null,
  },
];

export function storeInfo(key) {
  return STORES.find((s) => s.key === key) || STORES[STORES.length - 1];
}
