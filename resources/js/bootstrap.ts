import axios from 'axios';

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Auto logout: sesi habis (401/419) → kembali ke login dengan pesan
// "Sesi berakhir, silakan login kembali" (PRD Bab 13 — Security)
window.axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (
            (status === 401 || status === 419) &&
            !window.location.pathname.startsWith('/login')
        ) {
            window.location.href = '/login?expired=1';
        }

        return Promise.reject(error);
    },
);
