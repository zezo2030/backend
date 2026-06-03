import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { MediaUploadRequestDto } from './dto/media-upload.dto.js';
import { MediaService } from './media.service.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard)
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('uploads')
  issueUploads(@Body() dto: MediaUploadRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.issueUploads(user.sub, dto);
  }
}
