/**
 * SchoolFlow SaaS - Application Configuration
 * 
 * Supports both Live Firebase / Google Cloud configuration and
 * a plug-and-play Sandbox environment for instant local testing.
 */
const CONFIG_KEY = 'schoolflow_saas_config';

const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export const AppConfig = {
  // Google OAuth 2.0 Web Client ID (from Google Cloud Console)
  googleClientId: "",

  // Firebase Configuration (for live Cloud Firestore & Google Auth)
  firebase: { ...defaultFirebaseConfig },

  // Current active mode: 'firebase' (if keys present) or 'sandbox'
  get mode() {
    return (this.firebase && this.firebase.apiKey && this.firebase.projectId) ? 'firebase' : 'sandbox';
  },

  // Load configuration from localStorage or environment
  load() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.googleClientId) this.googleClientId = parsed.googleClientId;
        if (parsed.firebase) this.firebase = { ...defaultFirebaseConfig, ...parsed.firebase };
      }
    } catch (e) {
      console.warn("Could not load SaaS config from localStorage", e);
    }
    return this;
  },

  // Save updated configuration
  save(newConfig) {
    if (newConfig.googleClientId !== undefined) this.googleClientId = newConfig.googleClientId.trim();
    if (newConfig.firebase) this.firebase = { ...this.firebase, ...newConfig.firebase };
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      googleClientId: this.googleClientId,
      firebase: this.firebase
    }));
  },

  // Reset to defaults
  reset() {
    localStorage.removeItem(CONFIG_KEY);
    this.googleClientId = "";
    this.firebase = { ...defaultFirebaseConfig };
  }
};

AppConfig.load();
