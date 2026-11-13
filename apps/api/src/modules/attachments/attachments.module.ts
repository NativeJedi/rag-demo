import { Controller, Get, Module, Post } from '@nestjs/common';
import { NotImplementedPhase } from '../../common/not-implemented';

@Controller('attachments')
export class AttachmentsController {
  @Post()
  upload(): never {
    throw new NotImplementedPhase(7);
  }

  @Get(':id')
  get(): never {
    throw new NotImplementedPhase(7);
  }
}

@Module({ controllers: [AttachmentsController] })
export class AttachmentsModule {}
