import { createVerificationService } from './create-verification-service';

const service = await createVerificationService();

service.listen();
