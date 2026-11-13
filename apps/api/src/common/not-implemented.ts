import { HttpException, HttpStatus } from '@nestjs/common';

/** Planned-but-unbuilt code path: always 501 with the phase that delivers it. */
export class NotImplementedPhase extends HttpException {
  constructor(phase: number) {
    super(
      { error: { code: 'not_implemented', message: `Planned for phase ${phase}` } },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
