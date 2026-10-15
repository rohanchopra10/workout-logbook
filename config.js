// Workout Logbook settings.
// Supabase Project URL and Publishable key. These two values are safe to be public:
// the database only lets each signed-in person read their own data.
// Leave them empty to run the app without accounts (data stays on the phone only).
window.LOGBOOK_CONFIG = {
  supabaseUrl: 'https://ekpkhvqjllquhztbtpsx.supabase.co',
  supabaseKey: 'sb_publishable_z8ZHoUymQPQmOg5x2S3dOQ_GC2hORHs',
  // AI coach button shows only for the account whose email has this SHA-256 hash (the server checks again).
  coachFor: '9449674c9e94cbfb68ef495b0485f6861630af00a0297a79af370a09874908e2'
};
