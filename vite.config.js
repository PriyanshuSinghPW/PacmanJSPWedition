import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [],
    server: {
        allowedHosts: ['d0288b8daeee.ngrok-free.app'],
    },
    test: {
        environment: 'jsdom',
        coverage: {
            reporter: ['text', 'json', 'lcov'],
            reportOnFailure: true,
        },
    },
})
