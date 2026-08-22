export const PRIVACY_STORAGE_KEY = "kopilka-hide-amounts";

export const EARLY_PRIVACY_SCRIPT = `(()=>{try{const hidden=localStorage.getItem(${JSON.stringify(PRIVACY_STORAGE_KEY)})==='true';document.documentElement.dataset.privacy=hidden?'hidden':'visible'}catch{document.documentElement.dataset.privacy='visible'}})()`;
