import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpStatus,
    Post,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { RegisterDto } from './dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { ITokens } from './interfaces';
import { REFRESH_TOKEN } from './constants';
import { Cookie } from '@common/common/decorators';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        const user = await this.authService.register(dto);

        if (!user) {
            throw new BadRequestException(`Ошибка при регистрации пользователя с данными: ${JSON.stringify(dto)}`);
        }
    }

    @Post('login')
    async login(@Body() dto: LoginDto, @Res() res: Response) {
        const tokens = await this.authService.login(dto);

        if (!tokens) {
            throw new BadRequestException(`Не удалось войти с данными: ${JSON.stringify(dto)}`);
        }

        // return { accessToken: tokens.accessToken };
        this.setRefreshTokenToCookie(tokens, res);
    }

    @Get('refresh-tokens')
    async refreshTokens(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response) {
        if (!refreshToken) {
            throw new UnauthorizedException();
        }
        const tokens = await this.authService.refreshToken(refreshToken);

        if (!tokens) {
            throw new UnauthorizedException();
        }
        this.setRefreshTokenToCookie(tokens, res);
    }

    private setRefreshTokenToCookie(tokens: ITokens, res: Response) {
        if (!tokens) {
            throw new UnauthorizedException();
        }
        res.cookie(REFRESH_TOKEN, tokens.refreshToken.token, {
            httpOnly: true,
            sameSite: 'lax',
            expires: new Date(tokens.refreshToken.exp),
            secure: this.configService.get('NODE_ENV', 'development') === 'production',
            path: '/',
        });
        res.status(HttpStatus.CREATED).json({ accessToken: tokens.accessToken });
    }
}