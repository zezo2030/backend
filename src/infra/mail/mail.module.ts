import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMailSender, MAIL_SENDER } from './mail.provider.js';

const mailSenderFactory: Provider = {
  provide: MAIL_SENDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => createMailSender(config)
};

@Global()
@Module({
  providers: [mailSenderFactory],
  exports: [MAIL_SENDER]
})
export class MailModule {}
