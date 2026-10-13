import { openDatabase } from './db.js';
import { createApp } from './app.js';

const db = openDatabase();
const port = Number(process.env.PORT || 8091);
const server = createApp(db);
server.listen(port, '0.0.0.0', () => console.log(`Online Sneakers Shop ready at http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
