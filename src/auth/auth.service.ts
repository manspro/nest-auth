import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { LoginDto, RegisterDto } from './dto';
import { ITokens } from './interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { v4 } from 'uuid';
import { Token, User } from '@prisma/client';
import { add } from 'date-fns';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly userService: UserService,
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async refreshToken(refreshToken: string): Promise<ITokens> {
        const token = await this.prismaService.token.delete({ where: { token: refreshToken } });

        if (!token) {
            throw new UnauthorizedException();
        }

        const user = await this.userService.findOne(token.userId);
        return this.generateTokens(user);
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

    async login(dto: LoginDto): Promise<ITokens> {
        try {
            const user = await this.userService.findOne(dto.email);

            if (!user || compareSync(dto.password, user.password)) {
                throw new UnauthorizedException('Неверный логин или пароль');
            }
            return this.generateTokens(user);
        } catch (err) {
            this.logger.error(err);
        }
    }

    private async generateTokens(user: User): Promise<ITokens> {
        const accessToken =
            'Bearer ' +
            this.jwtService.sign({
                id: user.id,
                email: user.email,
                roles: user.roles,
            });

        const refreshToken = await this.getRefreshToken(user.id);

        return { accessToken, refreshToken };
    }

    private async getRefreshToken(userId: string): Promise<Token> {
        return this.prismaService.token.create({
            data: {
                token: v4(),
                exp: add(new Date(), { months: 1 }),
                userId,
            },
        });
    }
}
