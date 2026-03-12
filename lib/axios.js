import axios from 'axios';

/**
 * Pre-configured axios instance that includes credentials (cookies) with every request.
 * Use this instead of bare `axios` to ensure session cookies are sent to API routes.
 */
const api = axios.create({
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
