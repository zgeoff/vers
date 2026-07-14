import { createKeysService } from './create-keys-service';

const service = await createKeysService();

service.listen();
