import { Controller, Get, Module } from '@nestjs/common';
import type { Capabilities } from '@chatbot/shared';
import { CapabilitiesService } from './capabilities.service';

@Controller('capabilities')
export class CapabilitiesController {
  constructor(private readonly service: CapabilitiesService) {}

  @Get()
  get(): Capabilities {
    return this.service.get();
  }
}

@Module({
  controllers: [CapabilitiesController],
  providers: [CapabilitiesService],
  exports: [CapabilitiesService],
})
export class CapabilitiesModule {}
