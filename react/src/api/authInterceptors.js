import instance from './axios';

instance.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('authToken');

      if (token) {
        if (!config.headers) {
          config.headers = {};
        }

        config.headers.Authorization = `Token ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default instance;
