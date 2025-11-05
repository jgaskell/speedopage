/**
 * Authentication Service for SpeedoPage
 * Handles user registration, login, and JWT token management
 */

const AuthService = {
  // Token storage key
  TOKEN_KEY: 'speedopage_auth_token',
  USER_KEY: 'speedopage_user',

  /**
   * Get stored JWT token
   */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  /**
   * Store JWT token
   */
  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  /**
   * Remove JWT token
   */
  removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  /**
   * Get stored user info
   */
  getUser() {
    const userJson = localStorage.getItem(this.USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  },

  /**
   * Store user info
   */
  setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  /**
   * Remove user info
   */
  removeUser() {
    localStorage.removeItem(this.USER_KEY);
  },

  /**
   * Check if user is authenticated (has token AND user data)
   */
  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  /**
   * Validate token by checking with server
   */
  async validateToken() {
    const result = await this.getCurrentUser();
    return result.success;
  },

  /**
   * Register a new user
   */
  async register(email, password, displayName) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, displayName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store token and user info
      this.setToken(data.token);
      this.setUser(data.user);

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Login user
   */
  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user info
      this.setToken(data.token);
      this.setUser(data.user);

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      // Call logout endpoint (optional, since JWT is stateless)
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      this.removeToken();
      this.removeUser();
    }
  },

  /**
   * Get current user info from server
   */
  async getCurrentUser() {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user');
      }

      // Update stored user info
      this.setUser(data.user);

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Get current user error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Make authenticated API request
   */
  async apiRequest(url, options = {}) {
    const token = this.getToken();

    // Check if token exists for authenticated requests
    if (!token) {
      return {
        success: false,
        error: 'Please login to continue',
        needsAuth: true
      };
    }

    const headers = {
      ...options.headers,
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        // If unauthorized, clear token
        if (response.status === 401) {
          this.removeToken();
          this.removeUser();
          return {
            success: false,
            error: 'Your session has expired. Please login again.',
            needsAuth: true
          };
        }
        throw new Error(data.error || 'API request failed');
      }

      return { success: true, data };
    } catch (error) {
      console.error('API request error:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}
