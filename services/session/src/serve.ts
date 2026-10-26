import { createSessionService } from './create-session-service';

const service = await createSessionService();

service.serve();
