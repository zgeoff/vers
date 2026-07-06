import { createAvatarService } from './create-avatar-service';

const service = await createAvatarService();

service.listen();
