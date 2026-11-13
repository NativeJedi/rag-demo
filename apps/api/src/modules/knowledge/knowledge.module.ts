import { Controller, Delete, Get, Module, Post } from '@nestjs/common';
import { NotImplementedPhase } from '../../common/not-implemented';

@Controller('knowledge')
export class KnowledgeController {
  @Get('documents')
  list(): never {
    throw new NotImplementedPhase(6);
  }

  @Post('documents')
  upload(): never {
    throw new NotImplementedPhase(6);
  }

  @Delete('documents/:id')
  remove(): never {
    throw new NotImplementedPhase(6);
  }

  @Post('search')
  search(): never {
    throw new NotImplementedPhase(6);
  }
}

@Module({ controllers: [KnowledgeController] })
export class KnowledgeModule {}
