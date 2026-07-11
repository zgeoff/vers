import { createActivityService } from './create-activity-service';

const service = await createActivityService();

service.listen();
