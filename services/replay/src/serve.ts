import { createReplayService } from './create-replay-service';

const service = await createReplayService();

service.listen();
