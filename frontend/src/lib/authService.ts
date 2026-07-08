export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
}

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email';

/**
 * Dynamically loads the Google Identity Services client script.
 */
function loadGISScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (document.getElementById('google-jssdk')) return resolve();

    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Initializes the GIS client.
 */
let tokenClient: any = null;

export async function initGoogleAuth(): Promise<void> {
  if (typeof window === 'undefined') return;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    console.warn('Google Client ID not found. Using Mock Authentication mode.');
    return;
  }

  await loadGISScript();

  try {
    // @ts-ignore
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error !== undefined) {
          throw tokenResponse;
        }
        localStorage.setItem('google_access_token', tokenResponse.access_token);
        localStorage.setItem('google_token_expiry', String(Date.now() + tokenResponse.expires_in * 1000));
        
        // Fetch user profile info
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        })
          .then(res => res.json())
          .then(profile => {
            localStorage.setItem('google_user_profile', JSON.stringify({
              name: profile.name || 'Supervisor',
              email: profile.email || 'supervisor@sapori.lk',
              picture: profile.picture
            }));
            window.dispatchEvent(new Event('auth-status-change'));
          })
          .catch(err => {
            console.error('Error fetching user profile', err);
          });
      },
    });
  } catch (err) {
    console.error('Error initializing Google GIS Client:', err);
  }
}

/**
 * Start the Google login process.
 */
export async function loginWithGoogle(): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  
  if (!clientId) {
    // Mock login for offline testing and easy validation
    console.log('Simulating Google Auth Flow...');
    localStorage.setItem('google_access_token', 'mock_google_access_token_12345');
    localStorage.setItem('google_token_expiry', String(Date.now() + 3600 * 1000));
    localStorage.setItem('google_user_profile', JSON.stringify({
      name: 'Chaminda Rajapaksa',
      email: 'chaminda.r@sapori.lk',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'
    }));
    window.dispatchEvent(new Event('auth-status-change'));
    return;
  }

  if (!tokenClient) {
    await initGoogleAuth();
  }

  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    throw new Error('Google Auth SDK not loaded or initialized');
  }
}

/**
 * Logs the user out.
 */
export function logoutGoogle(): void {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_expiry');
  localStorage.removeItem('google_user_profile');
  window.dispatchEvent(new Event('auth-status-change'));
}

/**
 * Checks if the user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const token = localStorage.getItem('google_access_token');
    const expiry = localStorage.getItem('google_token_expiry');
    if (!token || !expiry) return false;
    return Date.now() < Number(expiry);
  } catch (e) {
    console.error('Failed to read auth from localStorage:', e);
    return false;
  }
}

/**
 * Gets the current user profile.
 */
export function getUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const profileStr = localStorage.getItem('google_user_profile');
    if (!profileStr) return null;
    return JSON.parse(profileStr);
  } catch (e) {
    console.error('Failed to read user profile from localStorage:', e);
    return null;
  }
}
