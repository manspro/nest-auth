import {
    BadRequestException,
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    HttpStatus,
    Post,
    Query,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { RegisterDto } from './dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { ITokens } from './interfaces';
import { REFRESH_TOKEN } from './constants';
import { Cookie, Public, UserAgent } from '@common/common/decorators';
import { UserResponse } from '../user/responses';
import { GoogleGuard } from './guards/google.guard';
import { HttpService } from '@nestjs/axios';
import { map, mergeMap } from 'rxjs';
import { handleTimeoutAndErrors } from '@common/common/helpers';
import { Provider } from '@prisma/client';
import { YandexGuard } from './guards/yandex.guard';

@Public()
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {}

    @UseInterceptors(ClassSerializerInterceptor)
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        const user = await this.authService.register(dto);

        if (!user) {
            throw new BadRequestException(`Ошибка при регистрации пользователя с данными: ${JSON.stringify(dto)}`);
        }
        return new UserResponse(user);
    }

    @Post('login')
    async login(@Body() dto: LoginDto, @Res() res: Response, @UserAgent() agent: string) {
        const tokens = await this.authService.login(dto, agent);

        if (!tokens) {
            throw new BadRequestException(`Не удалось войти с данными: ${JSON.stringify(dto)}`);
        }
        await this.setRefreshTokenToCookie(tokens, res);
    }

    @Get('logout')
    async logout(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response) {
        if (!refreshToken) {
            res.sendStatus(HttpStatus.OK);
            return;
        }
        await this.authService.deleteRefreshToken(refreshToken);
        res.cookie(REFRESH_TOKEN, '', { httpOnly: true, secure: true, expires: new Date() });
        res.sendStatus(HttpStatus.OK);
    }

    @Get('refresh-tokens')
    async refreshTokens(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response, @UserAgent() agent: string) {
        if (!refreshToken) {
            throw new UnauthorizedException();
        }
        const tokens = await this.authService.refreshToken(refreshToken, agent);

        if (!tokens) {
            throw new UnauthorizedException();
        }
        await this.setRefreshTokenToCookie(tokens, res);
    }

    @UseGuards(GoogleGuard)
    @Get('google')
    googleAuth() {}

    @UseGuards(GoogleGuard)
    @Get('google/callback')
    googleAuthCallback(@Req() req: Request, @Res() res: Response) {
        const token = req.user['accessToken'];
        return res.redirect(`http://localhost:3000/api/auth/success-google?token=${token}`);
    }

    @Get('success-google')
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    successGoogle(@Query('token') token: string, @UserAgent() agent: string, @Res() res: Response) {
        return this.httpService.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`).pipe(
            mergeMap(({ data: { email } }) => this.authService.providerAuth(email, agent, Provider.GOOGLE)),
            map((data) => this.setRefreshTokenToCookie(data, res)),
            handleTimeoutAndErrors(),
        );
    }

    @UseGuards(YandexGuard)
    @Get('yandex')
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    yandexAuth() {}

    @UseGuards(YandexGuard)
    @Get('yandex/callback')
    yandexAuthCallback(@Req() req: Request, @Res() res: Response) {
        const token = req.user['accessToken'];
        return res.redirect(`http://localhost:3000/api/auth/success-yandex?token=${token}`);
    }

    @Get('success-yandex')
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    successYandex(@Query('token') token: string, @UserAgent() agent: string, @Res() res: Response) {
        return this.httpService.get(`https://login.yandex.ru/info?format=json&oauth_token=${token}`).pipe(
            mergeMap(({ data: { default_email } }) =>
                this.authService.providerAuth(default_email, agent, Provider.YANDEX),
            ),
            map((data) => this.setRefreshTokenToCookie(data, res)),
            handleTimeoutAndErrors(),
        );
    }

    private async setRefreshTokenToCookie(tokens: ITokens, res: Response): Promise<void> {
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
