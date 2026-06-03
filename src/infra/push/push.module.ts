import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FcmAdapter, PUSH_DISPATCHER, StubFcmAdapter } from './push.provider.js';

const pushProviderFactory: Provider = {
  provide: PUSH_DISPATCHER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const provider = config.get<string>('push.provider', 'stub');
    return provider === 'fcm' ? new FcmAdapter(config) : new StubFcmAdapter();
  }
};

@Module({
  providers: [pushProviderFactory],
  exports: [PUSH_DISPATCHER]
})
export class PushModule {}
