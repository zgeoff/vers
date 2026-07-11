import { createUserService } from './create-user-service';

const service = await createUserService();

service.listen();
