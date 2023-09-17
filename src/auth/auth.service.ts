import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { LoginDto, RegisterDto } from './dto';
import { ITokens } from './interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { v4 } from 'uuid';
import { Provider, Token, User } from '@prisma/client';
import { add } from 'date-fns';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly userService: UserService,
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async refreshToken(refreshToken: string, agent: string): Promise<ITokens> {
        const token = await this.prismaService.token.findUnique({ where: { token: refreshToken } });
        if (!token) {
            throw new UnauthorizedException();
        }
        await this.prismaService.token.delete({ where: { token: refreshToken } });

        if (new Date(token.exp) < new Date()) {
            throw new UnauthorizedException();
        }

        const user = await this.userService.findOne(token.userId);
        return this.generateTokens(user, agent);
    }

    async register(dto: RegisterDto) {
        try {
            const user = await this.userService.findOne(dto.email);
            if (user) {
                throw new ConflictException('Пользователь  с такими данными уже зарегистрирован');
            }
            return this.userService.save(dto);
        } catch (err) {
            this.logger.error(err);
            return null;
        }
    }

    async login(dto: LoginDto, agent: string): Promise<ITokens> {
        try {
            const user = await this.userService.findOne(dto.email, true);

            if (!user || !compareSync(dto.password, user.password)) {
                throw new UnauthorizedException('Неверный логин или пароль');
            }
            return this.generateTokens(user, agent);
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    private async generateTokens(user: User, agent: string): Promise<ITokens> {
        const accessToken =
            'Bearer ' +
            this.jwtService.sign({
                id: user.id,
                email: user.email,
                roles: user.roles,
            });

        const refreshToken = await this.getRefreshToken(user.id, agent);

        return { accessToken, refreshToken };
    }

    private async getRefreshToken(userId: string, agent: string): Promise<Token> {
        const _token = await this.prismaService.token.findFirst({
            where: {
                userId,
                userAgent: agent,
            },
        });
        const token = _token?.token ?? '';
        return this.prismaService.token.upsert({
            where: { token },
            update: {
                token: v4(),
                exp: add(new Date(), { months: 1 }),
            },
            create: {
                token: v4(),
                exp: add(new Date(), { months: 1 }),
                userId,
                userAgent: agent,
            },
        });
    }

    async deleteRefreshToken(token: string) {
        return this.prismaService.token.delete({ where: { token } });
    }

    async providerAuth(email: string, agent: string, provider: Provider) {
        const userExist = await this.userService.findOne(email);
        if (userExist) {
            const user = await this.userService.save({ email, provider });

            return this.generateTokens(user, agent);
        }
        try {
            const user = await this.userService.save({ email, provider });

            if (!user) {
                throw new HttpException(
                    `Ошибка при создании пользователя с email: ${email} в Google`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            return this.generateTokens(user, agent);
        } catch (err) {
            this.logger.error(err);
            return null;
        }
    }
}
