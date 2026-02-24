import '@testing-library/jest-dom';

// Keep test environment deterministic for modules that validate env vars at import time.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test-project.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.NEXT_PUBLIC_APP_URL ||= 'https://pointsmax.test'
