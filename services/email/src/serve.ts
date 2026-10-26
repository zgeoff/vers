import { createEmailService } from './create-email-service';

const service = await createEmailService();

service.serve();
