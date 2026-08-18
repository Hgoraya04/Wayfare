import 'dotenv/config';
import { createApp } from './apiServer.js';

const PORT = process.env.PORT || 4000;

createApp().listen(PORT, () => {
  console.log(`Wayfare API running on http://localhost:${PORT}`);
});
