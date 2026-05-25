const SUPABASE_URL = 'https://bmatatqpqflinpqqqvwej.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wOAoanqkhdkef0kQIGWZ9g_sGAPpgZj';

class SupabaseClient {
  constructor() {
    this.url = SUPABASE_URL;
    this.anonKey = SUPABASE_ANON_KEY;
  }

  async fetchWithAuth(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.anonKey}`,
      'apikey': this.anonKey,
      ...options.headers
    };

    const response = await fetch(`${this.url}/rest/v1${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getAnnotations(pageUrl) {
    try {
      const encodedUrl = encodeURIComponent(pageUrl);
      const data = await this.fetchWithAuth(`/annotations?page_url=eq.${encodedUrl}&select=*`);
      return data;
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
      return [];
    }
  }

  async createAnnotation(annotation) {
    try {
      const data = await this.fetchWithAuth('/annotations', {
        method: 'POST',
        body: JSON.stringify(annotation)
      });
      return data[0];
    } catch (error) {
      console.error('Failed to create annotation:', error);
      throw error;
    }
  }

  async updateAnnotation(id, updates) {
    try {
      const data = await this.fetchWithAuth(`/annotations?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      return data[0];
    } catch (error) {
      console.error('Failed to update annotation:', error);
      throw error;
    }
  }

  async deleteAnnotation(id) {
    try {
      await this.fetchWithAuth(`/annotations?id=eq.${id}`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      throw error;
    }
  }

  async deleteAllAnnotations(pageUrl) {
    try {
      const encodedUrl = encodeURIComponent(pageUrl);
      await this.fetchWithAuth(`/annotations?page_url=eq.${encodedUrl}`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      console.error('Failed to delete annotations:', error);
      throw error;
    }
  }
}

const supabase = new SupabaseClient();

export { supabase };
