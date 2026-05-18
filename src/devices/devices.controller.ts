import {
  Body,
  Controller,
  Delete,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PushService } from '../push/push.service';

@Controller('devices')
@UseGuards(AuthGuard('jwt'))
export class DevicesController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  async register(
    @Body() body: { token: string; platform: 'ios' | 'android' | 'web' },
    @Req() req: { user: { id: number } },
  ) {
    await this.pushService.registerDeviceToken(
      req.user.id,
      body.token,
      body.platform ?? 'web',
    );
    return { ok: true };
  }

  @Delete('unregister')
  async unregister(
    @Body() body: { token: string },
    @Req() req: { user: { id: number } },
  ) {
    await this.pushService.unregisterDeviceToken(req.user.id, body.token);
    return { ok: true };
  }
}
