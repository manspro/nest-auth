import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { genSalt, hashSync } from 'bcryptjs';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { IJwtPayload } from '../auth/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { convertToSecondsUtil } from '@common/common/utils';

@Injectable()
export class UserService {
    constructor(
        private readonly prismaService: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly configService: ConfigService,
    ) {}

    async save(user: Partial<User>) {
        const hashPassword = user.password ? await this.hashPassword(user.password) : null;

        return this.prismaService.user.create({
            data: {
                email: user.email,
                password: hashPassword,
                roles: ['USER'],
            },
        });
    }

    async findOne(idOrEmail: string, isReset: boolean = false) {
        if (isReset) {
            await this.cacheManager.del(idOrEmail);
        }

        const user = await this.cacheManager.get<User>(idOrEmail);

        if (!user) {
            const user = await this.prismaService.user.findFirst({
                where: {
                    OR: [{ id: idOrEmail }, { email: idOrEmail }],
                },
            });
            if (!user) {
                return null;
            }
            await this.cacheManager.set(idOrEmail, user, convertToSecondsUtil(this.configService.get('JWT_EXP')));
            return user;
        }
        return user;
    }

    async delete(id: string, user: IJwtPayload) {
        if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
            throw new ForbiddenException();
        }

        await Promise.all([this.cacheManager.del(id), this.cacheManager.del(user.email)]);
        return this.prismaService.user.delete({ where: { id }, select: { id: true } });
    }

    private async hashPassword(password: string) {
        return hashSync(password, await genSalt(10));
    }
}
