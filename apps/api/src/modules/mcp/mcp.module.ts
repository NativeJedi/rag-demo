import { Controller, Delete, Get, Module, Post } from '@nestjs/common';
import { NotImplementedPhase } from '../../common/not-implemented';

@Controller('mcp')
export class McpController {
  @Get('servers')
  listServers(): never {
    throw new NotImplementedPhase(8);
  }

  @Post('servers')
  addServer(): never {
    throw new NotImplementedPhase(8);
  }

  @Delete('servers/:id')
  removeServer(): never {
    throw new NotImplementedPhase(8);
  }

  @Get('resources')
  resources(): never {
    throw new NotImplementedPhase(8);
  }

  @Get('prompts')
  prompts(): never {
    throw new NotImplementedPhase(8);
  }
}

@Module({ controllers: [McpController] })
export class McpModule {}
